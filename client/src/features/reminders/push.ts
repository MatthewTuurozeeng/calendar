import { supabase } from '../../lib/supabase'

// Web Push on this device (README §4.5, §7). The subscription is stored in
// push_subscriptions; send-reminders pushes to every active one.

export type PushState =
  | 'unsupported' // no service worker or Push API in this browser
  | 'needs-install' // iPhone/iPad: push only works from the Home Screen app
  | 'not-configured' // no VAPID key in this build
  | 'denied' // the user blocked notifications for this site
  | 'off'
  | 'on'

const vapidPublicKey = import.meta.env.VITE_VAPID_PUBLIC_KEY

function isIos(): boolean {
  return /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
}

async function registration(): Promise<ServiceWorkerRegistration | undefined> {
  return navigator.serviceWorker.getRegistration()
}

export async function getPushState(): Promise<PushState> {
  const supported = 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window
  if (!supported) return isIos() ? 'needs-install' : 'unsupported'
  if (!vapidPublicKey) return 'not-configured'
  if (Notification.permission === 'denied') return 'denied'
  const subscription = await (await registration())?.pushManager.getSubscription()
  return subscription ? 'on' : 'off'
}

/** VAPID keys are base64url; the Push API wants raw bytes. */
function keyBytes(base64url: string): Uint8Array<ArrayBuffer> {
  const base64 = (base64url + '='.repeat((4 - (base64url.length % 4)) % 4)).replace(/-/g, '+').replace(/_/g, '/')
  return Uint8Array.from(atob(base64), (c) => c.charCodeAt(0))
}

export async function enablePush(userId: string): Promise<PushState> {
  if (!vapidPublicKey) return 'not-configured'
  const permission = await Notification.requestPermission()
  if (permission !== 'granted') return permission === 'denied' ? 'denied' : 'off'

  const reg = await navigator.serviceWorker.ready
  const subscription =
    (await reg.pushManager.getSubscription()) ??
    (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyBytes(vapidPublicKey) }))
  const json = subscription.toJSON()

  const { error } = await supabase.from('push_subscriptions').upsert(
    {
      user_id: userId,
      endpoint: subscription.endpoint,
      p256dh: json.keys!.p256dh,
      auth: json.keys!.auth,
      user_agent: navigator.userAgent.slice(0, 300),
      last_seen_at: new Date().toISOString(),
      revoked_at: null,
    },
    { onConflict: 'endpoint' },
  )
  if (error) {
    await subscription.unsubscribe()
    throw error
  }
  return 'on'
}

export async function disablePush(): Promise<PushState> {
  const subscription = await (await registration())?.pushManager.getSubscription()
  if (subscription) {
    const { error } = await supabase.from('push_subscriptions').delete().eq('endpoint', subscription.endpoint)
    if (error) throw error
    await subscription.unsubscribe()
  }
  return 'off'
}

/** Asks send-reminders to push a test notification to this account's devices. */
export async function sendTestNotification(): Promise<{ devices: number; sent: number }> {
  const { data, error } = await supabase.functions.invoke<{ devices: number; sent: number }>('send-reminders')
  if (error) throw error
  return data ?? { devices: 0, sent: 0 }
}
