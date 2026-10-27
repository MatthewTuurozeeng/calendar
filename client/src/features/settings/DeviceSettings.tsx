import { useEffect, useState } from 'react'
import { secondaryButtonClass } from '../../components/ui/form'
import { Switch } from '../../components/ui/Switch'
import { useSession } from '../auth/auth-context'
import { isInstalled, useInstallPrompt } from '../pwa/install'
import { disablePush, enablePush, getPushState, sendTestNotification, type PushState } from '../reminders/push'
import type { TrackSave } from './save-status'
import { SettingRow } from './SettingsLayout'

const PUSH_HINTS: Record<PushState, string> = {
  unsupported: "This browser can't receive push notifications.",
  'needs-install': 'On iPhone and iPad, add the app to your Home Screen first, then turn this on from there.',
  'not-configured': 'Push needs a VAPID key in this build (VITE_VAPID_PUBLIC_KEY).',
  denied: 'Notifications are blocked for this site. Allow them in your browser or phone settings, then reload.',
  off: 'Get reminders on this device, even when the app is closed.',
  on: 'Reminders arrive on this device, even when the app is closed.',
}

export function InstallAppRow() {
  const { canInstall, install } = useInstallPrompt()
  const installed = isInstalled()

  return (
    <SettingRow
      id="install-app"
      label="Install app"
      description={
        installed
          ? 'Running as an installed app.'
          : canInstall
            ? 'Add the calendar to your home screen and open it like any other app.'
            : 'In Chrome on Android, open the ⋮ menu and choose "Add to home screen" or "Install app".'
      }
      inline
    >
      {installed ? (
        <span className="text-sm font-medium text-ink-muted">Installed</span>
      ) : (
        <button
          id="install-app"
          type="button"
          className={secondaryButtonClass}
          disabled={!canInstall}
          onClick={() => void install()}
        >
          Install
        </button>
      )}
    </SettingRow>
  )
}

export function PushNotificationsRow({ track }: { track: TrackSave }) {
  const session = useSession()
  const [state, setState] = useState<PushState | null>(null)
  const [busy, setBusy] = useState(false)
  const [testResult, setTestResult] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    getPushState()
      .then((s) => !cancelled && setState(s))
      .catch(() => !cancelled && setState('unsupported'))
    return () => {
      cancelled = true
    }
  }, [])

  async function toggle(on: boolean) {
    setBusy(true)
    setTestResult(null)
    await track(async () => setState(on ? await enablePush(session.user.id) : await disablePush()))
    setBusy(false)
  }

  async function test() {
    setBusy(true)
    setTestResult(null)
    await track(async () => {
      const { devices, sent } = await sendTestNotification()
      setTestResult(
        devices === 0
          ? 'No devices are set up for notifications yet.'
          : `Sent to ${sent} of ${devices} device${devices === 1 ? '' : 's'}.`,
      )
    })
    setBusy(false)
  }

  const canToggle = state === 'on' || state === 'off'

  return (
    <SettingRow
      id="push-notifications"
      label="Notifications on this device"
      description={
        <>
          {state ? PUSH_HINTS[state] : 'Checking this device…'}
          {testResult && <span className="mt-1 block font-medium text-ink">{testResult}</span>}
          {state === 'on' && (
            <button
              type="button"
              onClick={() => void test()}
              disabled={busy}
              className={`${secondaryButtonClass} mt-2 min-h-9 px-3 text-sm`}
            >
              Send a test notification
            </button>
          )}
        </>
      }
      inline
    >
      <Switch
        id="push-notifications"
        checked={state === 'on'}
        disabled={!canToggle || busy}
        onChange={(on) => void toggle(on)}
        aria-describedby="push-notifications-description"
      />
    </SettingRow>
  )

  
}


