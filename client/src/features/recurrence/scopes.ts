import { parseLocal, toDateString } from '../../lib/dates'
import type { TablesUpdate } from '../../types/database'
import type { EventTiming } from '../events/timing'
import {
  dateToFloating,
  floatingToDate,
  fromFloating,
  occurrenceTiming,
  originalToFloating,
  seriesStart,
  toFloating,
  type SeriesColumns,
} from './expand'

// Pure planning for the three edit scopes (README §4.4); api.ts writes the results.

export type EditScope = 'this' | 'following' | 'all'

export type OccurrenceValues = {
  title: string
  description: string | null
  location: string | null
  category_id: string | null
  timing: EventTiming
  /** Series-wide; "this event" edits ignore it. Omit to leave reminders unchanged. */
  reminder_offsets?: number[]
}

const DAY_MS = 86_400_000

function startOfFloatingDay(d: Date): number {
  return Math.floor(d.getTime() / DAY_MS) * DAY_MS
}

function timingToFloating(timing: EventTiming, timeZone: string): Date {
  return timing.allDay ? dateToFloating(toDateString(timing.start)) : toFloating(timing.start, timeZone)
}

/**
 * For "all events": the series' new first occurrence. It moves by as many days
 * as the edited occurrence moved and takes its new time of day and length.
 */
export function shiftSeries(series: SeriesColumns, original: string, edited: EventTiming): EventTiming {
  const o = originalToFloating(series, original)
  const t = timingToFloating(edited, series.timezone)
  const s = seriesStart(series)
  const newStart = new Date(
    startOfFloatingDay(s) + (startOfFloatingDay(t) - startOfFloatingDay(o)) + (t.getTime() - startOfFloatingDay(t)),
  )

  if (edited.allDay) {
    const days = Math.round(
      (dateToFloating(toDateString(edited.end)).getTime() - dateToFloating(toDateString(edited.start)).getTime()) /
        DAY_MS,
    )
    const startDate = floatingToDate(newStart)
    return {
      allDay: true,
      start: parseLocal(startDate),
      end: parseLocal(floatingToDate(new Date(newStart.getTime() + days * DAY_MS))),
    }
  }
  const start = fromFloating(newStart, series.timezone)
  return { allDay: false, start, end: new Date(start.getTime() + edited.end.getTime() - edited.start.getTime()) }
}

function sameTiming(a: EventTiming, b: EventTiming): boolean {
  return a.allDay === b.allDay && a.start.getTime() === b.start.getTime() && a.end.getTime() === b.end.getTime()
}

/**
 * For "this event": the exception columns. Only fields that differ from the
 * series are stored, so later "all events" edits still reach the rest.
 */
export function exceptionOverrides(
  series: SeriesColumns & Pick<OccurrenceValues, 'title' | 'description' | 'location' | 'category_id'>,
  original: string,
  edited: OccurrenceValues,
): TablesUpdate<'event_exceptions'> {
  const moved = !sameTiming(occurrenceTiming(series, original), edited.timing)
  const differs = <T,>(value: T, base: T) => (value !== base ? value : null)
  return {
    is_cancelled: false,
    new_title: differs(edited.title, series.title),
    new_description: differs(edited.description, series.description),
    new_location: differs(edited.location, series.location),
    new_category_id: differs(edited.category_id, series.category_id),
    new_start_at: moved && !edited.timing.allDay ? edited.timing.start.toISOString() : null,
    new_end_at: moved && !edited.timing.allDay ? edited.timing.end.toISOString() : null,
    new_start_date: moved && edited.timing.allDay ? toDateString(edited.timing.start) : null,
    new_end_date: moved && edited.timing.allDay ? toDateString(edited.timing.end) : null,
  }
}

/** The day before an occurrence, where "this and following" ends the old series. */
export function dayBefore(series: SeriesColumns, original: string): string {
  return floatingToDate(new Date(startOfFloatingDay(originalToFloating(series, original)) - DAY_MS))
}
