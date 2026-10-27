// Sends due reminders as Web Push notifications (README §7).
// - Cron calls it every minute with the secret key: claim due rows, push, record the result.
// - The app calls it with a user JWT to send that user a test notification.
// Needs the secrets VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY and VAPID_SUBJECT (a mailto: address).

import '@supabase/functions-js/edge-runtime.d.ts'
import { withSupabase } from '@supabase/server'
import type { SupabaseClient } from '@supabase/supabase-js'
import webpush from 'web-push'

const MAX_ATTEMPTS = 3
const BATCH_SIZE = 50

type Reminder = {
  id: string
  user_id: string
  event_id: string | null
  task_id: string | null
  offset_minutes: number
  occurrence_start: string | null
  remind_at: string
  attempt_count: number
  idempotency_key: string
}

type Payload = { title: string; body: string; url: string; tag: string }

type Profile = { timezone: string; calendar_prefs: { time_format?: string } | null }

webpush.setVapidDetails(
  Deno.env.get('VAPID_SUBJECT') ?? '',
  Deno.env.get('VAPID_PUBLIC_KEY') ?? '',
  Deno.env.get('VAPID_PRIVATE_KEY') ?? '',
)

export default {
  fetch: withSupabase({ auth: ['user', 'secret'] }, async (_req, ctx) => {
    const admin = ctx.supabaseAdmin
    try {
      if (ctx.authMode === 'user') {
        const result = await pushToUser(admin, ctx.userClaims!.id, {
          title: 'Notifications are on',
          body: 'Reminders for your events and tasks will arrive like this.',
          url: '/settings',
          tag: 'test',
        })
        return Response.json(result)
      }
      return Response.json(await sendDue(admin))
    } catch (err) {
      // Never log event or task content (README §12).
      console.error('send-reminders failed:', err instanceof Error ? err.message : err)
      return Response.json({ error: 'send failed' }, { status: 500 })
    }
  }),
}

async function sendDue(admin: SupabaseClient) {
  const { data, error } = await admin.rpc('claim_due_reminders', { batch_size: BATCH_SIZE })
  if (error) throw error
  const claimed = (data ?? []) as Reminder[]
  const profiles = new Map<string, Profile>()
  let sent = 0

  for (const reminder of claimed) {
    try {
      if (!profiles.has(reminder.user_id)) {
        const { data: profile } = await admin
          .from('profiles')
          .select('timezone, calendar_prefs')
          .eq('id', reminder.user_id)
          .single()
        profiles.set(reminder.user_id, profile ?? { timezone: 'UTC', calendar_prefs: null })
      }
      const payload = await buildPayload(admin, reminder, profiles.get(reminder.user_id)!)
      if (!payload) {
        await finish(admin, reminder.id, { status: 'cancelled', last_error: 'source gone' })
        continue
      }

      const result = await pushToUser(admin, reminder.user_id, payload)
      if (result.sent > 0) {
        sent += 1
        await finish(admin, reminder.id, { status: 'sent', sent_at: new Date().toISOString(), last_error: null })
      } else if (result.devices === 0) {
        await finish(admin, reminder.id, { status: 'failed', last_error: 'no active push subscriptions' })
      } else {
        await retryOrFail(admin, reminder, result.lastError ?? 'push failed')
      }
    } catch (err) {
      await retryOrFail(admin, reminder, err instanceof Error ? err.message : 'unknown error')
    }
  }

  return { claimed: claimed.length, sent }
}

async function finish(admin: SupabaseClient, id: string, values: Record<string, unknown>) {
  const { error } = await admin.from('reminders').update({ ...values, locked_at: null }).eq('id', id)
  if (error) throw error
}

/** Back to the queue for the next minute's run, or failed after the last attempt. */
function retryOrFail(admin: SupabaseClient, reminder: Reminder, message: string) {
  const status = reminder.attempt_count >= MAX_ATTEMPTS ? 'failed' : 'pending'
  return finish(admin, reminder.id, { status, last_error: message.slice(0, 500) })
}

async function buildPayload(admin: SupabaseClient, r: Reminder, profile: Profile): Promise<Payload | null> {
  const source = r.event_id
    ? await admin.from('events').select('title, all_day').eq('id', r.event_id).maybeSingle()
    : await admin.from('tasks').select('title, status').eq('id', r.task_id!).maybeSingle()
  if (source.error) throw source.error
  if (!source.data) return null
  if ('status' in source.data && source.data.status === 'completed') return null

  // The moment the reminder is about: remind_at plus the offset.
  const at = new Date(new Date(r.remind_at).getTime() + r.offset_minutes * 60_000)
  const time = new Intl.DateTimeFormat('en-GB', {
    timeZone: profile.timezone,
    hour: 'numeric',
    minute: '2-digit',
    hour12: profile.calendar_prefs?.time_format !== '24h',
  }).format(at)
  const lead = r.offset_minutes === 0 ? 'Now' : `In ${formatOffset(r.offset_minutes)}`
  const isTask = !!r.task_id

  return {
    title: source.data.title as string,
    body: isTask ? `Due ${lead.toLowerCase()} · ${time}` : `${lead} · ${time}`,
    url: isTask ? '/tasks' : '/calendar',
    tag: r.idempotency_key,
  }
}

function formatOffset(minutes: number): string {
  const plural = (n: number, unit: string) => `${n} ${unit}${n === 1 ? '' : 's'}`
  if (minutes % 1440 === 0) return plural(minutes / 1440, 'day')
  if (minutes % 60 === 0) return plural(minutes / 60, 'hour')
  return plural(minutes, 'minute')
}

/** Pushes to each of the user's active devices; revokes subscriptions the push service has dropped. */
async function pushToUser(admin: SupabaseClient, userId: string, payload: Payload) {
  const { data: subscriptions, error } = await admin
    .from('push_subscriptions')
    .select('id, endpoint, p256dh, auth')
    .eq('user_id', userId)
    .is('revoked_at', null)
  if (error) throw error

  let sent = 0
  let lastError: string | undefined
  for (const s of subscriptions ?? []) {
    try {
      await webpush.sendNotification(
        { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
        JSON.stringify(payload),
        { TTL: 3600, urgency: 'high' },
      )
      sent += 1
    } catch (err) {
      const status = (err as { statusCode?: number }).statusCode
      if (status === 404 || status === 410) {
        await admin.from('push_subscriptions').update({ revoked_at: new Date().toISOString() }).eq('id', s.id)
      } else {
        lastError = `push service returned ${status ?? 'an error'}`
      }
    }
  }
  return { devices: subscriptions?.length ?? 0, sent, lastError }
}
