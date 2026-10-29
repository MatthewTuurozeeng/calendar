import type { Occurrence } from '../recurrence/expand'

// Pure helpers for the Today page's summary and free-time sections (README §4.6).

export type DaySummary = {
  tasksDone: number
  /** Due today, plus anything completed today. Overdue tasks are counted separately. */
  tasksPlanned: number
  overdue: number
  /** Timed events that have ended. Task blocks count as focus time instead. */
  eventsDone: number
  eventsPlanned: number
  /** Minutes of task time-blocks scheduled today. */
  focusMinutes: number
}

type SummaryTasks = { dueToday: number; doneToday: number; overdue: number }

export function daySummary(events: Occurrence[], tasks: SummaryTasks, now: Date): DaySummary {
  const timed = events.filter((e) => !e.timing.allDay)
  const meetings = timed.filter((e) => !e.task)
  const focusMinutes = timed
    .filter((e) => e.task)
    .reduce((sum, e) => sum + (e.timing.end.getTime() - e.timing.start.getTime()) / 60_000, 0)
  return {
    tasksDone: tasks.doneToday,
    tasksPlanned: tasks.dueToday + tasks.doneToday,
    overdue: tasks.overdue,
    eventsDone: meetings.filter((e) => e.timing.end <= now).length,
    eventsPlanned: meetings.length,
    focusMinutes: Math.round(focusMinutes),
  }
}

export type Gap = { start: Date; end: Date; minutes: number }

/**
 * Free stretches of at least `minMinutes` between timed events, from now (or
 * dayStart, if later) until dayEnd. Overlapping events are merged; all-day
 * events don't block time.
 */
export function freeGaps(events: Occurrence[], dayStart: Date, dayEnd: Date, now: Date, minMinutes = 30): Gap[] {
  const from = new Date(Math.max(dayStart.getTime(), now.getTime()))
  if (from >= dayEnd) return []

  const busy = events
    .filter((e) => !e.timing.allDay && e.timing.end > from && e.timing.start < dayEnd)
    .map((e) => ({ start: e.timing.start.getTime(), end: e.timing.end.getTime() }))
    .sort((a, b) => a.start - b.start)

  const gaps: Gap[] = []
  let cursor = from.getTime()
  const push = (end: number) => {
    const minutes = Math.floor((end - cursor) / 60_000)
    if (minutes >= minMinutes) gaps.push({ start: new Date(cursor), end: new Date(end), minutes })
  }
  for (const b of busy) {
    if (b.start > cursor) push(Math.min(b.start, dayEnd.getTime()))
    cursor = Math.max(cursor, b.end)
    if (cursor >= dayEnd.getTime()) return gaps
  }
  push(dayEnd.getTime())
  return gaps
}

/** "45m", "2h", "1h 30m": short enough for a phone-width stat. */
export function formatMinutes(minutes: number): string {
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  if (h === 0) return `${m}m`
  return m === 0 ? `${h}h` : `${h}h ${m}m`
}
