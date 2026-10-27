// Works out which reminder rows should exist (README §4.5, §7). Pure, so the
// client's Vitest suite can test it (client/tests/unit/reminder-plan.test.ts).
//
// Occurrences are expanded the same way as client/src/features/recurrence/expand.ts:
// rrule runs on "floating" dates whose UTC fields hold the wall-clock time in the
// event's zone, so "10:00 every Monday" stays at 10:00 across DST changes.
// Edge Functions can't import that module (Deno needs file extensions), hence this copy.

import * as rruleModule from 'rrule'
import { fromZonedTime, toZonedTime } from 'date-fns-tz'

// Deno loads rrule's CommonJS build (exports under `default`); Vite loads its ES build.
const { RRule } = (rruleModule as unknown as { default?: typeof rruleModule }).default ?? rruleModule

/** Reminders are generated this far ahead; the hourly sync rolls the window forward. */
export const WINDOW_DAYS = 14
const DAY_MS = 86_400_000

export type EventInput = {
  id: string
  user_id: string
  all_day: boolean
  start_at: string | null
  end_at: string | null
  start_date: string | null
  end_date: string | null
  timezone: string
  rrule: string | null
  reminder_offsets: number[]
}

export type ExceptionInput = {
  event_id: string
  original_start: string | null
  original_date: string | null
  is_cancelled: boolean
  new_start_at: string | null
  new_start_date: string | null
}

export type TaskInput = {
  id: string
  user_id: string
  status: string
  due_at: string | null
  due_date: string | null
  reminder_offsets: number[]
}

export type ReminderRow = {
  user_id: string
  event_id: string | null
  task_id: string | null
  occurrence_start: string
  offset_minutes: number
  remind_at: string
  idempotency_key: string
}

export type PlanInput = {
  events: EventInput[]
  exceptions: ExceptionInput[]
  tasks: TaskInput[]
  /** The user's zone, for tasks due on a date. */
  timeZone: string
  /** 'HH:mm' that all-day events and date-only tasks remind relative to. */
  allDayReminderTime: string
}

// ---------- Floating time ----------

function toFloating(instant: Date, timeZone: string): Date {
  const z = toZonedTime(instant, timeZone)
  return new Date(
    Date.UTC(z.getFullYear(), z.getMonth(), z.getDate(), z.getHours(), z.getMinutes(), z.getSeconds()),
  )
}

function fromFloating(floating: Date, timeZone: string): Date {
  return fromZonedTime(floating.toISOString().slice(0, 19), timeZone)
}

const dateToFloating = (date: string) => new Date(`${date}T00:00:00Z`)
const floatingToDate = (floating: Date) => floating.toISOString().slice(0, 10)

/** A date at a wall-clock time in a zone, e.g. 2026-10-26 at 08:00 in Accra. */
export function atTime(date: string, time: string, timeZone: string): Date {
  return fromZonedTime(`${date}T${time}:00`, timeZone)
}

// ---------- Occurrences ----------

type Start = {
  /** Identifies the occurrence: ISO instant (timed) or date (all-day). */
  original: string
  /** When it actually starts after any exception: ISO instant or date. */
  start: string
  allDay: boolean
}

/** Occurrences of an event starting roughly within [from, to); callers filter exactly. */
export function eventStarts(event: EventInput, exceptions: ExceptionInput[], from: Date, to: Date): Start[] {
  if (!event.rrule) {
    const start = event.all_day ? event.start_date! : new Date(event.start_at!).toISOString()
    return [{ original: start, start, allDay: event.all_day }]
  }

  const dtstart = event.all_day ? dateToFloating(event.start_date!) : toFloating(new Date(event.start_at!), event.timezone)
  const rule = new RRule({ ...RRule.parseString(event.rrule), dtstart })
  const originalOf = (f: Date) =>
    event.all_day ? floatingToDate(f) : fromFloating(f, event.timezone).toISOString()
  const exceptionOriginal = (x: ExceptionInput) => x.original_date ?? new Date(x.original_start!).toISOString()

  const changed = new Set(exceptions.map(exceptionOriginal))
  const starts: Start[] = rule
    .between(new Date(toFloating(from, event.timezone).getTime() - DAY_MS), new Date(toFloating(to, event.timezone).getTime() + DAY_MS), true)
    .map(originalOf)
    .filter((original) => !changed.has(original))
    .map((original) => ({ original, start: original, allDay: event.all_day }))

  for (const x of exceptions) {
    if (x.is_cancelled) continue
    const original = exceptionOriginal(x)
    if (x.new_start_date) starts.push({ original, start: x.new_start_date, allDay: true })
    else if (x.new_start_at) starts.push({ original, start: new Date(x.new_start_at).toISOString(), allDay: false })
    else starts.push({ original, start: original, allDay: event.all_day })
  }
  return starts
}

// ---------- Plan ----------

/** Every reminder that should be pending, with remind_at in [now, now + WINDOW_DAYS). */
export function planReminders(input: PlanInput, now: Date): ReminderRow[] {
  const windowEnd = new Date(now.getTime() + WINDOW_DAYS * DAY_MS)
  const rows: ReminderRow[] = []
  const exceptionsByEvent = new Map<string, ExceptionInput[]>()
  for (const x of input.exceptions) {
    exceptionsByEvent.set(x.event_id, [...(exceptionsByEvent.get(x.event_id) ?? []), x])
  }

  function add(row: Omit<ReminderRow, 'remind_at' | 'idempotency_key'>, start: Date, key: string) {
    const remindAt = new Date(start.getTime() - row.offset_minutes * 60_000)
    if (remindAt < now || remindAt >= windowEnd) return
    rows.push({ ...row, remind_at: remindAt.toISOString(), idempotency_key: key })
  }

  for (const event of input.events) {
    if (event.reminder_offsets.length === 0) continue
    // Occurrences can start up to the largest offset after the window and still remind inside it.
    const lead = Math.max(...event.reminder_offsets) * 60_000
    const starts = eventStarts(event, exceptionsByEvent.get(event.id) ?? [], now, new Date(windowEnd.getTime() + lead))

    for (const s of starts) {
      const start = s.allDay ? atTime(s.start, input.allDayReminderTime, event.timezone) : new Date(s.start)
      // The original is a date for all-day series, an instant otherwise.
      const original = event.all_day ? atTime(s.original, '00:00', event.timezone) : new Date(s.original)
      for (const offset of event.reminder_offsets) {
        // Keyed by the actual start, so moving an occurrence makes a new reminder.
        add(
          { user_id: event.user_id, event_id: event.id, task_id: null, occurrence_start: original.toISOString(), offset_minutes: offset },
          start,
          `event:${event.id}:${s.start}:${offset}`,
        )
      }
    }
  }

  for (const task of input.tasks) {
    if (task.status === 'completed' || task.reminder_offsets.length === 0) continue
    const due = task.due_at
      ? new Date(task.due_at)
      : task.due_date
        ? atTime(task.due_date, input.allDayReminderTime, input.timeZone)
        : null
    if (!due) continue
    const dueKey = task.due_at ? due.toISOString() : task.due_date!
    for (const offset of task.reminder_offsets) {
      add(
        { user_id: task.user_id, event_id: null, task_id: task.id, occurrence_start: due.toISOString(), offset_minutes: offset },
        due,
        `task:${task.id}:${dueKey}:${offset}`,
      )
    }
  }

  return rows
}
