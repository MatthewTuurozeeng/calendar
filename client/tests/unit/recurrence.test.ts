import { describe, expect, it } from 'vitest'
import type { EventRow } from '../../src/features/events/api'
import {
  countBefore,
  expandEvent,
  isFirstOccurrence,
  isOccurrence,
  seriesUntil,
  type ExceptionRow,
} from '../../src/features/recurrence/expand'
import { buildRule, describeRule, endRuleOn, parseRule, type RepeatConfig } from '../../src/features/recurrence/rule'
import { dayBefore, exceptionOverrides, shiftSeries } from '../../src/features/recurrence/scopes'
import { toDateString } from '../../src/lib/dates'

const NY = 'America/New_York'

function event(overrides: Partial<EventRow> = {}): EventRow {
  return {
    id: 'e1',
    user_id: 'u1',
    category_id: null,
    course_id: null,
    task_id: null,
    kind: 'general',
    title: 'Lecture',
    description: null,
    location: null,
    all_day: false,
    // Monday 26 Oct 2026, 10:00–11:00 New York (EDT, UTC-4)
    start_at: '2026-10-26T14:00:00.000Z',
    end_at: '2026-10-26T15:00:00.000Z',
    start_date: null,
    end_date: null,
    timezone: NY,
    rrule: 'FREQ=WEEKLY;BYDAY=MO',
    series_until: null,
    reminder_offsets: [],
    created_at: '',
    updated_at: '',
    ...overrides,
  }
}

function allDayEvent(overrides: Partial<EventRow> = {}): EventRow {
  return event({
    all_day: true,
    start_at: null,
    end_at: null,
    start_date: '2026-10-26',
    end_date: '2026-10-27',
    rrule: 'FREQ=DAILY;COUNT=5',
    ...overrides,
  })
}

function exception(overrides: Partial<ExceptionRow>): ExceptionRow {
  return {
    id: 'x1',
    user_id: 'u1',
    event_id: 'e1',
    original_start: null,
    original_date: null,
    is_cancelled: false,
    new_start_at: null,
    new_end_at: null,
    new_start_date: null,
    new_end_date: null,
    new_title: null,
    new_location: null,
    new_description: null,
    new_category_id: null,
    created_at: '',
    updated_at: '',
    ...overrides,
  }
}

const range = (from: string, to: string) => [new Date(from), new Date(to)] as const

describe('rules', () => {
  const start = new Date(Date.UTC(2026, 9, 26, 10)) // floating Monday 26 Oct, 10:00

  it('round-trips weekly, monthly and end options', () => {
    const configs: RepeatConfig[] = [
      { freq: 'weekly', interval: 2, weekdays: [1, 3], monthlyBy: 'date', end: { kind: 'never' } },
      { freq: 'monthly', interval: 1, weekdays: [], monthlyBy: 'weekday', end: { kind: 'count', count: 6 } },
      { freq: 'daily', interval: 1, weekdays: [], monthlyBy: 'date', end: { kind: 'until', date: '2026-12-31' } },
    ]
    for (const config of configs) expect(parseRule(buildRule(config, start))).toEqual(config)
  })

  it('writes RFC 5545 rules', () => {
    expect(
      buildRule({ freq: 'weekly', interval: 1, weekdays: [3, 1], monthlyBy: 'date', end: { kind: 'never' } }, start),
    ).toBe('FREQ=WEEKLY;BYDAY=MO,WE')
    expect(
      buildRule({ freq: 'monthly', interval: 1, weekdays: [], monthlyBy: 'weekday', end: { kind: 'never' } }, start),
    ).toBe('FREQ=MONTHLY;BYDAY=4MO')
    // 29 Oct falls in the fifth week, so it repeats on the last Thursday.
    const fifthWeek = new Date(Date.UTC(2026, 9, 29, 10))
    expect(
      buildRule({ freq: 'monthly', interval: 1, weekdays: [], monthlyBy: 'weekday', end: { kind: 'never' } }, fifthWeek),
    ).toBe('FREQ=MONTHLY;BYDAY=-1TH')
  })

  it('describes rules in words', () => {
    expect(describeRule(parseRule('FREQ=WEEKLY;BYDAY=MO,WE;UNTIL=20261231T235959Z'), start)).toBe(
      'Every week on Monday and Wednesday, until 31 Dec 2026',
    )
    expect(describeRule(parseRule('FREQ=WEEKLY;BYDAY=MO,TU,WE,TH,FR'), start)).toBe('Every week on weekdays')
    expect(describeRule(parseRule('FREQ=MONTHLY;INTERVAL=2;BYDAY=4MO'), start)).toBe(
      'Every 2 months on the fourth Monday',
    )
    expect(describeRule(parseRule('FREQ=YEARLY;COUNT=3'), start)).toBe('Every year on 26 October, 3 times')
  })

  it('ends a rule on a date, replacing COUNT', () => {
    expect(endRuleOn('FREQ=DAILY;COUNT=10', '2026-10-30')).toBe('FREQ=DAILY;UNTIL=20261030T235959Z')
  })
})

describe('expandEvent', () => {
  it('returns a one-off event when it overlaps the range', () => {
    const e = event({ rrule: null })
    expect(expandEvent(e, [], ...range('2026-10-26T00:00:00Z', '2026-10-27T00:00:00Z'))).toHaveLength(1)
    expect(expandEvent(e, [], ...range('2026-10-27T00:00:00Z', '2026-10-28T00:00:00Z'))).toHaveLength(0)
  })

  it('keeps local time across a daylight-saving change', () => {
    // US clocks go back on 1 Nov 2026, so 10:00 moves from 14:00 UTC to 15:00 UTC.
    const occurrences = expandEvent(event(), [], ...range('2026-10-25T00:00:00Z', '2026-11-10T00:00:00Z'))
    expect(occurrences.map((o) => o.timing.start.toISOString())).toEqual([
      '2026-10-26T14:00:00.000Z',
      '2026-11-02T15:00:00.000Z',
      '2026-11-09T15:00:00.000Z',
    ])
    expect(occurrences.every((o) => o.timing.end.getTime() - o.timing.start.getTime() === 3_600_000)).toBe(true)
  })

  it('includes an occurrence that started before the range and is still running', () => {
    const e = event({ end_at: '2026-10-26T18:00:00.000Z' }) // 10:00–14:00
    const occurrences = expandEvent(e, [], ...range('2026-11-02T17:00:00Z', '2026-11-03T00:00:00Z'))
    expect(occurrences).toHaveLength(1)
  })

  it('stops at UNTIL and COUNT', () => {
    const until = event({ rrule: 'FREQ=WEEKLY;BYDAY=MO;UNTIL=20261102T235959Z' })
    expect(expandEvent(until, [], ...range('2026-10-01T00:00:00Z', '2027-01-01T00:00:00Z'))).toHaveLength(2)
    const count = event({ rrule: 'FREQ=DAILY;COUNT=3' })
    expect(expandEvent(count, [], ...range('2026-10-01T00:00:00Z', '2027-01-01T00:00:00Z'))).toHaveLength(3)
  })

  it('skips cancelled occurrences and applies overrides', () => {
    const exceptions = [
      exception({ id: 'cancel', original_start: '2026-11-02T15:00:00+00:00', is_cancelled: true }),
      exception({ id: 'rename', original_start: '2026-11-09T15:00:00+00:00', new_title: 'Guest lecture' }),
    ]
    const occurrences = expandEvent(event(), exceptions, ...range('2026-10-25T00:00:00Z', '2026-11-10T00:00:00Z'))
    expect(occurrences.map((o) => [o.timing.start.toISOString(), o.title])).toEqual([
      ['2026-10-26T14:00:00.000Z', 'Lecture'],
      ['2026-11-09T15:00:00.000Z', 'Guest lecture'],
    ])
  })

  it('shows a moved occurrence in its new place, even from outside the range', () => {
    const moved = exception({
      original_start: '2026-11-09T15:00:00.000Z',
      new_start_at: '2026-10-28T15:00:00.000Z',
      new_end_at: '2026-10-28T16:00:00.000Z',
    })
    const thisWeek = expandEvent(event(), [moved], ...range('2026-10-26T00:00:00Z', '2026-11-02T00:00:00Z'))
    expect(thisWeek.map((o) => o.timing.start.toISOString())).toEqual([
      '2026-10-26T14:00:00.000Z',
      '2026-10-28T15:00:00.000Z',
    ])
    expect(thisWeek[1].original).toBe('2026-11-09T15:00:00.000Z')
    const later = expandEvent(event(), [moved], ...range('2026-11-09T00:00:00Z', '2026-11-10T00:00:00Z'))
    expect(later).toHaveLength(0)
  })

  it('expands all-day series by date', () => {
    const occurrences = expandEvent(allDayEvent(), [], new Date(2026, 9, 27), new Date(2026, 9, 29))
    expect(occurrences.map((o) => [o.original, toDateString(o.timing.end)])).toEqual([
      ['2026-10-27', '2026-10-28'],
      ['2026-10-28', '2026-10-29'],
    ])
  })
})

describe('series helpers', () => {
  it('caches the end of the last occurrence', () => {
    expect(seriesUntil(event())).toBeNull()
    expect(seriesUntil(event({ rrule: 'FREQ=WEEKLY;BYDAY=MO;COUNT=2' }))).toBe('2026-11-02T16:00:00.000Z')
    // Last all-day occurrence is 30 Oct, so the series ends at midnight starting 31 Oct, New York time.
    expect(seriesUntil(allDayEvent())).toBe('2026-10-31T04:00:00.000Z')
  })

  it('recognises occurrences', () => {
    expect(isOccurrence(event(), '2026-11-02T15:00:00.000Z')).toBe(true)
    expect(isOccurrence(event(), '2026-11-02T14:00:00.000Z')).toBe(false)
    expect(isOccurrence(event(), '2026-11-03T15:00:00.000Z')).toBe(false)
    expect(isFirstOccurrence(event(), '2026-10-26T14:00:00.000Z')).toBe(true)
    expect(isFirstOccurrence(event(), '2026-11-02T15:00:00.000Z')).toBe(false)
    expect(countBefore(event(), '2026-11-09T15:00:00.000Z')).toBe(2)
    expect(dayBefore(event(), '2026-11-09T15:00:00.000Z')).toBe('2026-11-08')
  })
})

describe('edit scopes', () => {
  it('"all events" moves the series by the change made to one occurrence', () => {
    // Move the 9 Nov occurrence from 10:00–11:00 to 11:30–13:00 local time.
    const shifted = shiftSeries(event(), '2026-11-09T15:00:00.000Z', {
      allDay: false,
      start: new Date('2026-11-09T16:30:00Z'),
      end: new Date('2026-11-09T18:00:00Z'),
    })
    // The series still starts on 26 Oct, now at 11:30 EDT.
    expect(shifted.start.toISOString()).toBe('2026-10-26T15:30:00.000Z')
    expect(shifted.end.toISOString()).toBe('2026-10-26T17:00:00.000Z')
  })

  it('"all events" can turn a timed series into an all-day one', () => {
    const shifted = shiftSeries(event(), '2026-11-02T15:00:00.000Z', {
      allDay: true,
      start: new Date(2026, 10, 3),
      end: new Date(2026, 10, 4),
    })
    expect([toDateString(shifted.start), toDateString(shifted.end)]).toEqual(['2026-10-27', '2026-10-28'])
  })

  it('"this event" stores only what changed', () => {
    const series = event({ location: 'Room 1' })
    const original = '2026-11-02T15:00:00.000Z'
    const unchangedTime = { allDay: false, start: new Date(original), end: new Date('2026-11-02T16:00:00.000Z') }
    const overrides = exceptionOverrides(series, original, {
      title: 'Lecture',
      description: null,
      location: 'Room 2',
      category_id: null,
      timing: unchangedTime,
    })
    expect(overrides).toMatchObject({ new_title: null, new_location: 'Room 2', new_start_at: null, new_end_at: null })

    const moved = exceptionOverrides(series, original, {
      title: 'Lecture',
      description: null,
      location: 'Room 1',
      category_id: null,
      timing: { allDay: false, start: new Date('2026-11-03T15:00:00Z'), end: new Date('2026-11-03T16:00:00Z') },
    })
    expect(moved).toMatchObject({ new_location: null, new_start_at: '2026-11-03T15:00:00.000Z' })
  })
})
