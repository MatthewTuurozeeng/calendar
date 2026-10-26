import { fromZonedTime, toZonedTime } from 'date-fns-tz'
import { RRule } from 'rrule'
import { parseLocal } from '../../lib/dates'
import type { Tables } from '../../types/database'
import type { EventRow } from '../events/api'
import type { EventTiming } from '../events/timing'

// Expands a series row into its occurrences for a visible range (README §4.4, §6).
//
// rrule has no real time-zone support, so it runs on *floating* dates: Dates
// whose UTC fields hold the wall-clock time in the event's time zone. Results
// are converted back to real instants with the event's zone, which keeps
// "10:00 every Monday" at 10:00 local time across daylight-saving changes.

export type ExceptionRow = Tables<'event_exceptions'>

export type SeriesColumns = Pick<
  EventRow,
  'all_day' | 'start_at' | 'end_at' | 'start_date' | 'end_date' | 'timezone' | 'rrule'
>

/** One thing to show on the calendar: a one-off event, or one occurrence of a series. */
export type Occurrence = {
  /** Unique per occurrence, for UI keys. */
  key: string
  /** The stored row: the one-off event, or the whole series. */
  event: EventRow
  /** Which occurrence of a series: an ISO instant (timed) or 'yyyy-MM-dd' (all-day). Null for one-offs. */
  original: string | null
  exception: ExceptionRow | null
  timing: EventTiming
  title: string
  description: string | null
  location: string | null
  category_id: string | null
  /** Set when the event is a time block for a task (README §4.3). */
  task?: { id: string; status: string } | null
}

const DAY_MS = 86_400_000

// ---------- Floating time ----------

export function toFloating(instant: Date, timeZone: string): Date {
  const z = toZonedTime(instant, timeZone)
  return new Date(
    Date.UTC(z.getFullYear(), z.getMonth(), z.getDate(), z.getHours(), z.getMinutes(), z.getSeconds()),
  )
}

export function fromFloating(floating: Date, timeZone: string): Date {
  return fromZonedTime(floating.toISOString().slice(0, 19), timeZone)
}

export function dateToFloating(date: string): Date {
  return new Date(`${date}T00:00:00Z`)
}

export function floatingToDate(floating: Date): string {
  return floating.toISOString().slice(0, 10)
}

function addDaysToDate(date: string, days: number): string {
  return floatingToDate(new Date(dateToFloating(date).getTime() + days * DAY_MS))
}

// ---------- Series ----------

/** The series start as a floating date. */
export function seriesStart(series: SeriesColumns): Date {
  return series.all_day ? dateToFloating(series.start_date!) : toFloating(new Date(series.start_at!), series.timezone)
}

export function ruleFor(series: SeriesColumns): RRule {
  return new RRule({ ...RRule.parseString(series.rrule!), dtstart: seriesStart(series) })
}

function lengthDays(series: SeriesColumns): number {
  return Math.round((dateToFloating(series.end_date!).getTime() - dateToFloating(series.start_date!).getTime()) / DAY_MS)
}

function durationMs(series: SeriesColumns): number {
  return new Date(series.end_at!).getTime() - new Date(series.start_at!).getTime()
}

/** The original identifier of the occurrence that starts at `floating`. */
function originalAt(series: SeriesColumns, floating: Date): string {
  return series.all_day ? floatingToDate(floating) : fromFloating(floating, series.timezone).toISOString()
}

export function originalToFloating(series: SeriesColumns, original: string): Date {
  return series.all_day ? dateToFloating(original) : toFloating(new Date(original), series.timezone)
}

/** Unscheduled timing of one occurrence, before any exception. */
export function occurrenceTiming(series: SeriesColumns, original: string): EventTiming {
  if (series.all_day) {
    return { allDay: true, start: parseLocal(original), end: parseLocal(addDaysToDate(original, lengthDays(series))) }
  }
  const start = new Date(original)
  return { allDay: false, start, end: new Date(start.getTime() + durationMs(series)) }
}

/** The stored original of an exception, normalised to match `Occurrence.original`. */
export function exceptionOriginal(x: Pick<ExceptionRow, 'original_date' | 'original_start'>): string {
  return x.original_date ?? new Date(x.original_start!).toISOString()
}

/** Whether `original` is still an occurrence of the series, e.g. after its time or rule changed. */
export function isOccurrence(series: SeriesColumns, original: string): boolean {
  const f = originalToFloating(series, original)
  return ruleFor(series)
    .between(new Date(f.getTime() - 1000), new Date(f.getTime() + 1000), true)
    .some((d) => d.getTime() === f.getTime())
}

export function isFirstOccurrence(series: SeriesColumns, original: string): boolean {
  const first = ruleFor(series).all((_, i) => i < 1)[0]
  return !!first && first.getTime() === originalToFloating(series, original).getTime()
}

/** How many occurrences come before `original`. */
export function countBefore(series: SeriesColumns, original: string): number {
  const f = originalToFloating(series, original)
  return ruleFor(series)
    .between(seriesStart(series), f, true)
    .filter((d) => d < f).length
}

/** End of the last occurrence (cached as events.series_until), or null if the series never ends. */
export function seriesUntil(series: SeriesColumns): string | null {
  if (!series.rrule) return null
  const rule = ruleFor(series)
  if (!rule.options.count && !rule.options.until) return null
  const all = rule.all((_, i) => i < 10_000)
  const last = all[all.length - 1]
  // A rule that never fires (e.g. UNTIL before the start) ends where it starts.
  if (!last) return series.all_day ? midnightIn(series.start_date!, series.timezone) : series.start_at
  if (series.all_day) return midnightIn(addDaysToDate(floatingToDate(last), lengthDays(series)), series.timezone)
  return occurrenceTiming(series, originalAt(series, last)).end.toISOString()
}

function midnightIn(date: string, timeZone: string): string {
  return fromZonedTime(`${date}T00:00:00`, timeZone).toISOString()
}

// ---------- Expansion ----------

function overlaps(timing: EventTiming, rangeStart: Date, rangeEnd: Date): boolean {
  return timing.start < rangeEnd && timing.end > rangeStart
}

function makeOccurrence(event: EventRow, original: string | null, timing: EventTiming, x: ExceptionRow | null): Occurrence {
  return {
    key: original ? `${event.id}:${original}` : event.id,
    event,
    original,
    exception: x,
    timing,
    title: x?.new_title ?? event.title,
    description: x?.new_description ?? event.description,
    location: x?.new_location ?? event.location,
    category_id: x?.new_category_id ?? event.category_id,
  }
}

/** Timing of an occurrence after its exception's overrides. */
export function overriddenTiming(series: SeriesColumns, x: ExceptionRow): EventTiming {
  if (x.new_start_date && x.new_end_date) {
    return { allDay: true, start: parseLocal(x.new_start_date), end: parseLocal(x.new_end_date) }
  }
  if (x.new_start_at && x.new_end_at) {
    return { allDay: false, start: new Date(x.new_start_at), end: new Date(x.new_end_at) }
  }
  return occurrenceTiming(series, exceptionOriginal(x))
}

/** The occurrences of one event row that overlap [rangeStart, rangeEnd). */
export function expandEvent(
  event: EventRow,
  exceptions: ExceptionRow[],
  rangeStart: Date,
  rangeEnd: Date,
): Occurrence[] {
  if (!event.rrule) {
    const timing: EventTiming = event.all_day
      ? { allDay: true, start: parseLocal(event.start_date!), end: parseLocal(event.end_date!) }
      : { allDay: false, start: new Date(event.start_at!), end: new Date(event.end_at!) }
    return overlaps(timing, rangeStart, rangeEnd) ? [makeOccurrence(event, null, timing, null)] : []
  }

  const rule = ruleFor(event)
  const changed = new Set(exceptions.map(exceptionOriginal))
  const result: Occurrence[] = []

  // Search a little wider than the range, since floating and real time differ by
  // up to a day, and an occurrence that started earlier can still be running.
  const span = event.all_day ? lengthDays(event) * DAY_MS : durationMs(event)
  const from = new Date(toFloating(rangeStart, event.timezone).getTime() - span - DAY_MS)
  const to = new Date(toFloating(rangeEnd, event.timezone).getTime() + DAY_MS)

  for (const floating of rule.between(from, to, true)) {
    const original = originalAt(event, floating)
    if (changed.has(original)) continue
    const timing = occurrenceTiming(event, original)
    if (overlaps(timing, rangeStart, rangeEnd)) result.push(makeOccurrence(event, original, timing, null))
  }

  // Edited occurrences, wherever they were moved to.
  for (const x of exceptions) {
    if (x.is_cancelled) continue
    const timing = overriddenTiming(event, x)
    if (overlaps(timing, rangeStart, rangeEnd)) {
      result.push(makeOccurrence(event, exceptionOriginal(x), timing, x))
    }
  }

  return result
}

export function compareOccurrences(a: Occurrence, b: Occurrence): number {
  if (a.timing.allDay !== b.timing.allDay) return a.timing.allDay ? -1 : 1
  return a.timing.start.getTime() - b.timing.start.getTime()
}
