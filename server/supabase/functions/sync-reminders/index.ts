// Regenerates the next 14 days of reminder rows (README §7).
// - The app calls it after saving an event, task or setting (user JWT): that user only.
// - Cron calls it hourly with the secret key: every user with reminders.
// Writes go through upsert_reminders, which never revives a sent reminder.

import '@supabase/functions-js/edge-runtime.d.ts'
import { withSupabase } from '@supabase/server'
import type { SupabaseClient } from '@supabase/supabase-js'
import { planReminders, type EventInput, type TaskInput } from '../_shared/reminder-plan.ts'

const EVENT_COLUMNS = 'id, user_id, all_day, start_at, end_at, start_date, end_date, timezone, rrule, reminder_offsets'
const TASK_COLUMNS = 'id, user_id, status, due_at, due_date, reminder_offsets'

export default {
  fetch: withSupabase({ auth: ['user', 'secret'] }, async (_req, ctx) => {
    const admin = ctx.supabaseAdmin
    try {
      const userIds = ctx.authMode === 'user' ? [ctx.userClaims!.id] : await usersWithReminders(admin)
      let written = 0
      for (const userId of userIds) written += await syncUser(admin, userId, new Date())
      return Response.json({ users: userIds.length, written })
    } catch (err) {
      // Counts and messages only; never event or task content (README §12).
      console.error('sync-reminders failed:', err instanceof Error ? err.message : err)
      return Response.json({ error: 'sync failed' }, { status: 500 })
    }
  }),
}

async function usersWithReminders(admin: SupabaseClient): Promise<string[]> {
  const [events, tasks] = await Promise.all([
    admin.from('events').select('user_id').neq('reminder_offsets', '{}'),
    admin.from('tasks').select('user_id').neq('reminder_offsets', '{}').neq('status', 'completed'),
  ])
  if (events.error) throw events.error
  if (tasks.error) throw tasks.error
  return [...new Set([...events.data, ...tasks.data].map((r) => r.user_id as string))]
}

async function syncUser(admin: SupabaseClient, userId: string, now: Date): Promise<number> {
  const since = new Date(now.getTime() - 86_400_000)
  const sinceDate = since.toISOString().slice(0, 10)

  const [profile, events, tasks] = await Promise.all([
    admin.from('profiles').select('timezone, notification_prefs').eq('id', userId).single(),
    admin
      .from('events')
      .select(EVENT_COLUMNS)
      .eq('user_id', userId)
      .neq('reminder_offsets', '{}')
      // One-offs that haven't started yet, and series that haven't ended.
      .or(
        `and(rrule.is.null,or(start_at.gte.${since.toISOString()},start_date.gte.${sinceDate})),` +
          `and(rrule.not.is.null,or(series_until.is.null,series_until.gte.${since.toISOString()}))`,
      ),
    admin
      .from('tasks')
      .select(TASK_COLUMNS)
      .eq('user_id', userId)
      .neq('reminder_offsets', '{}')
      .neq('status', 'completed'),
  ])
  if (profile.error) throw profile.error
  if (events.error) throw events.error
  if (tasks.error) throw tasks.error

  const seriesIds = (events.data as EventInput[]).filter((e) => e.rrule).map((e) => e.id)
  const exceptions = seriesIds.length
    ? await admin
        .from('event_exceptions')
        .select('event_id, original_start, original_date, is_cancelled, new_start_at, new_start_date')
        .in('event_id', seriesIds)
    : { data: [], error: null }
  if (exceptions.error) throw exceptions.error

  const prefs = (profile.data.notification_prefs ?? {}) as { all_day_reminder_time?: unknown }
  const allDayReminderTime =
    typeof prefs.all_day_reminder_time === 'string' && /^\d{2}:\d{2}$/.test(prefs.all_day_reminder_time)
      ? prefs.all_day_reminder_time
      : '08:00'

  const rows = planReminders(
    {
      events: events.data as EventInput[],
      exceptions: exceptions.data ?? [],
      tasks: tasks.data as TaskInput[],
      timeZone: profile.data.timezone,
      allDayReminderTime,
    },
    now,
  )
  if (rows.length === 0) return 0

  const { data, error } = await admin.rpc('upsert_reminders', { reminder_rows: rows })
  if (error) throw error
  return data as number
}
