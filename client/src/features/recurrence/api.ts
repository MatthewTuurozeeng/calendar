import { addDays } from 'date-fns'
import { toDateString } from '../../lib/dates'
import { supabase } from '../../lib/supabase'
import { notifyChange, type EventRow } from '../events/api'
import { timingToColumns, type EventTiming } from '../events/timing'
import {
  compareOccurrences,
  dateToFloating,
  exceptionOriginal,
  expandEvent,
  isFirstOccurrence,
  isOccurrence,
  seriesUntil,
  toFloating,
  countBefore,
  type ExceptionRow,
  type Occurrence,
} from './expand'
import { buildRule, endRuleOn, parseRule, type RepeatConfig } from './rule'
import { dayBefore, exceptionOverrides, shiftSeries, type EditScope, type OccurrenceValues } from './scopes'

// Reads and writes for recurring events. Writes are several requests, not one
// transaction; each step leaves the calendar showing something sensible.

/** Every occurrence overlapping [start, end), sorted (README §6 "Fetching a visible range"). */
export async function fetchOccurrences(start: Date, end: Date): Promise<Occurrence[]> {
  const startIso = start.toISOString()
  const endIso = end.toISOString()
  const startDate = toDateString(start)
  const endDate = toDateString(end)
  // series_until is an instant; a day of slack covers all-day series in other zones.
  const notEnded = `or(series_until.is.null,series_until.gte.${addDays(start, -1).toISOString()})`

  const { data: events, error } = await supabase
    .from('events')
    .select('*')
    .or(
      [
        `and(rrule.is.null,all_day.is.false,start_at.lt.${endIso},end_at.gt.${startIso})`,
        `and(rrule.is.null,all_day.is.true,start_date.lt.${endDate},end_date.gt.${startDate})`,
        `and(rrule.not.is.null,all_day.is.false,start_at.lt.${endIso},${notEnded})`,
        `and(rrule.not.is.null,all_day.is.true,start_date.lt.${endDate},${notEnded})`,
      ].join(','),
    )
  if (error) throw error

  const seriesIds = events.filter((e) => e.rrule).map((e) => e.id)
  const exceptions = seriesIds.length > 0 ? await fetchExceptions(seriesIds) : []
  const byEvent = new Map<string, ExceptionRow[]>()
  for (const x of exceptions) byEvent.set(x.event_id, [...(byEvent.get(x.event_id) ?? []), x])

  return events
    .flatMap((e) => expandEvent(e, byEvent.get(e.id) ?? [], start, end))
    .sort(compareOccurrences)
}

async function fetchExceptions(eventIds: string[]): Promise<ExceptionRow[]> {
  const { data, error } = await supabase.from('event_exceptions').select('*').in('event_id', eventIds)
  if (error) throw error
  return data
}

/** Timing and repeat columns, with series_until cached for range queries. */
export function scheduleColumns(timing: EventTiming, repeat: RepeatConfig | null, timeZone: string) {
  const columns = timingToColumns(timing)
  if (!repeat) return { ...columns, rrule: null, series_until: null }
  const start = timing.allDay ? dateToFloating(columns.start_date!) : toFloating(timing.start, timeZone)
  const rrule = buildRule(repeat, start)
  return { ...columns, rrule, series_until: seriesUntil({ ...columns, timezone: timeZone, rrule }) }
}

function contentColumns(values: OccurrenceValues) {
  return {
    title: values.title,
    description: values.description,
    location: values.location,
    category_id: values.category_id,
  }
}

function originalKey(series: EventRow, original: string) {
  return series.all_day ? { original_date: original } : { original_start: original }
}

/** The exception column that identifies an occurrence of this series. */
function originalColumn(series: EventRow) {
  return series.all_day ? ('original_date' as const) : ('original_start' as const)
}

/** Deletes exceptions that no longer match an occurrence of the series; returns how many. */
async function pruneExceptions(series: EventRow): Promise<number> {
  if (!series.rrule) {
    const { count, error } = await supabase.from('event_exceptions').delete({ count: 'exact' }).eq('event_id', series.id)
    if (error) throw error
    return count ?? 0
  }
  const exceptions = await fetchExceptions([series.id])
  const stale = exceptions.filter((x) => !isOccurrence(series, exceptionOriginal(x))).map((x) => x.id)
  if (stale.length === 0) return 0
  const { error } = await supabase.from('event_exceptions').delete().in('id', stale)
  if (error) throw error
  return stale.length
}

async function updateRow(id: string, values: Partial<EventRow>): Promise<EventRow> {
  const { data, error } = await supabase.from('events').update(values).eq('id', id).select().single()
  if (error) throw error
  return data
}

export type SaveResult = {
  /** Edited or cancelled occurrences dropped because they no longer fit the series. */
  removedExceptions: number
}

/** Saves an edit to an event or one occurrence of a series, in the chosen scope. */
export async function saveOccurrence(
  occurrence: Occurrence,
  scope: EditScope,
  values: OccurrenceValues,
  repeat: RepeatConfig | null,
): Promise<SaveResult> {
  const { event: series, original } = occurrence
  try {
    // A one-off event; adding a repeat turns it into a series.
    if (!original) {
      await updateRow(series.id, {
        ...contentColumns(values),
        ...scheduleColumns(values.timing, repeat, series.timezone),
      })
      return { removedExceptions: 0 }
    }

    if (scope === 'this') {
      const { error } = await supabase.from('event_exceptions').upsert(
        {
          user_id: series.user_id,
          event_id: series.id,
          ...originalKey(series, original),
          ...exceptionOverrides(series, original, values),
        },
        { onConflict: `event_id,${originalColumn(series)}` },
      )
      if (error) throw error
      return { removedExceptions: 0 }
    }

    if (scope === 'following' && !isFirstOccurrence(series, original)) {
      return await splitSeries(series, original, values, repeat)
    }

    // All occurrences. Stopping the repeat keeps the occurrence that was edited.
    const timing = repeat ? shiftSeries(series, original, values.timing) : values.timing
    const updated = await updateRow(series.id, {
      ...contentColumns(values),
      ...scheduleColumns(timing, repeat, series.timezone),
    })
    return { removedExceptions: await pruneExceptions(updated) }
  } finally {
    notifyChange()
  }
}

/** "This and following": end the series the day before, and start a new one here. */
async function splitSeries(
  series: EventRow,
  original: string,
  values: OccurrenceValues,
  repeat: RepeatConfig | null,
): Promise<SaveResult> {
  // A count carries over as the occurrences that were still to come.
  let nextRepeat = repeat
  const before = repeat?.end.kind === 'count' ? countBefore(series, original) : 0
  const oldEnd = parseRule(series.rrule!).end
  if (repeat?.end.kind === 'count' && oldEnd.kind === 'count' && repeat.end.count === oldEnd.count) {
    nextRepeat = { ...repeat, end: { kind: 'count', count: Math.max(1, oldEnd.count - before) } }
  }

  const { data: created, error } = await supabase
    .from('events')
    .insert({
      user_id: series.user_id,
      kind: series.kind,
      course_id: series.course_id,
      task_id: series.task_id,
      reminder_offsets: series.reminder_offsets,
      timezone: series.timezone,
      ...contentColumns(values),
      ...scheduleColumns(values.timing, nextRepeat, series.timezone),
    })
    .select()
    .single()
  if (error) throw error

  // Exceptions after the split move to the new series (README §4.4).
  const { error: moveError } = await supabase
    .from('event_exceptions')
    .update({ event_id: created.id })
    .eq('event_id', series.id)
    .gte(originalColumn(series), original)
  if (moveError) throw moveError

  const rrule = endRuleOn(series.rrule!, dayBefore(series, original))
  await updateRow(series.id, { rrule, series_until: seriesUntil({ ...series, rrule }) })

  return { removedExceptions: await pruneExceptions(created) }
}

/** Deletes an event, or occurrences of a series in the chosen scope. */
export async function deleteOccurrence(occurrence: Occurrence, scope: EditScope): Promise<void> {
  const { event: series, original } = occurrence
  try {
    if (!original || scope === 'all' || (scope === 'following' && isFirstOccurrence(series, original))) {
      const { error } = await supabase.from('events').delete().eq('id', series.id)
      if (error) throw error
      return
    }

    if (scope === 'this') {
      const { error } = await supabase.from('event_exceptions').upsert(
        {
          user_id: series.user_id,
          event_id: series.id,
          ...originalKey(series, original),
          is_cancelled: true,
          new_title: null,
          new_description: null,
          new_location: null,
          new_category_id: null,
          new_start_at: null,
          new_end_at: null,
          new_start_date: null,
          new_end_date: null,
        },
        { onConflict: `event_id,${originalColumn(series)}` },
      )
      if (error) throw error
      return
    }

    // This and following.
    const rrule = endRuleOn(series.rrule!, dayBefore(series, original))
    await updateRow(series.id, { rrule, series_until: seriesUntil({ ...series, rrule }) })
    const { error } = await supabase
      .from('event_exceptions')
      .delete()
      .eq('event_id', series.id)
      .gte(originalColumn(series), original)
    if (error) throw error
  } finally {
    notifyChange()
  }
}
