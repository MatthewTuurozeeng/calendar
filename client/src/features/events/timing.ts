import { addDays, addHours, addMinutes, startOfHour } from 'date-fns'
import { parseLocal, toDateString } from '../../lib/dates'
import type { Tables } from '../../types/database'

/** When an event happens. For all-day events `end` is the exclusive midnight after the last day. */
export type EventTiming = {
  allDay: boolean
  start: Date
  end: Date
}

type TimingColumns = Pick<Tables<'events'>, 'all_day' | 'start_at' | 'end_at' | 'start_date' | 'end_date'>

export function timingToColumns(timing: EventTiming): TimingColumns {
  return timing.allDay
    ? {
        all_day: true,
        start_date: toDateString(timing.start),
        end_date: toDateString(timing.end),
        start_at: null,
        end_at: null,
      }
    : {
        all_day: false,
        start_at: timing.start.toISOString(),
        end_at: timing.end.toISOString(),
        start_date: null,
        end_date: null,
      }
}

export function timingFromRow(row: TimingColumns): EventTiming {
  return row.all_day
    ? { allDay: true, start: parseLocal(row.start_date!), end: parseLocal(row.end_date!) }
    : { allDay: false, start: new Date(row.start_at!), end: new Date(row.end_at!) }
}

/** A slot starting at the next full hour, one hour long unless `minutes` says otherwise. */
export function defaultTiming(now = new Date(), minutes = 60): EventTiming {
  const start = addHours(startOfHour(now), 1)
  return { allDay: false, start, end: addMinutes(start, minutes) }
}

/** Fills in a missing end, which FullCalendar leaves after some drags. */
export function withDefaultEnd(allDay: boolean, start: Date, end: Date | null): EventTiming {
  const fallback = allDay ? addDays(start, 1) : addHours(start, 1)
  return { allDay, start, end: end && end > start ? end : fallback }
}
