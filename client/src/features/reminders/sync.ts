import { useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import { eventChanges } from '../events/api'
import { taskChanges } from '../tasks/api'

// After a save, sync-reminders regenerates this user's reminders (README §7).
// The database trigger has already cancelled the stale ones, so a failed or
// delayed sync can only miss a reminder, never send a wrong one.

const DEBOUNCE_MS = 1500
let timer: number | undefined

/** Queues a sync; several saves in a row make one call. */
export function requestReminderSync() {
  window.clearTimeout(timer)
  timer = window.setTimeout(() => {
    supabase.functions.invoke('sync-reminders').then(
      ({ error }) => error && console.warn('Reminder sync failed:', error.message),
      (err: unknown) => console.warn('Reminder sync failed:', err),
    )
  }, DEBOUNCE_MS)
}

/** Syncs reminders after any event or task change; mount once inside the signed-in app. */
export function useReminderSync() {
  useEffect(() => {
    eventChanges.addEventListener('change', requestReminderSync)
    taskChanges.addEventListener('change', requestReminderSync)
    return () => {
      eventChanges.removeEventListener('change', requestReminderSync)
      taskChanges.removeEventListener('change', requestReminderSync)
    }
  }, [])
}
