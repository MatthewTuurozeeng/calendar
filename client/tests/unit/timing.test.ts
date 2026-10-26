import { describe, expect, it } from 'vitest'
import { defaultTiming, timingFromRow, timingToColumns, withDefaultEnd } from '../../src/features/events/timing'

describe('timingToColumns', () => {
  it('stores all-day events as dates with an exclusive end', () => {
    const columns = timingToColumns({
      allDay: true,
      start: new Date(2026, 9, 26),
      end: new Date(2026, 9, 28),
    })
    expect(columns).toEqual({
      all_day: true,
      start_date: '2026-10-26',
      end_date: '2026-10-28',
      start_at: null,
      end_at: null,
    })
  })

  it('stores timed events as UTC timestamps', () => {
    const start = new Date(2026, 9, 26, 9, 30)
    const end = new Date(2026, 9, 26, 10, 30)
    const columns = timingToColumns({ allDay: false, start, end })
    expect(columns).toEqual({
      all_day: false,
      start_at: start.toISOString(),
      end_at: end.toISOString(),
      start_date: null,
      end_date: null,
    })
  })

  it('round-trips through timingFromRow', () => {
    const allDay = { allDay: true, start: new Date(2026, 0, 1), end: new Date(2026, 0, 2) }
    const timed = { allDay: false, start: new Date(2026, 0, 1, 8), end: new Date(2026, 0, 1, 9, 15) }
    expect(timingFromRow(timingToColumns(allDay))).toEqual(allDay)
    expect(timingFromRow(timingToColumns(timed))).toEqual(timed)
  })
})

describe('defaultTiming', () => {
  it('starts at the next full hour and lasts an hour', () => {
    const timing = defaultTiming(new Date(2026, 9, 26, 14, 20))
    expect(timing).toEqual({
      allDay: false,
      start: new Date(2026, 9, 26, 15),
      end: new Date(2026, 9, 26, 16),
    })
  })
})

describe('withDefaultEnd', () => {
  const start = new Date(2026, 9, 26, 9)

  it('keeps a valid end', () => {
    const end = new Date(2026, 9, 26, 11)
    expect(withDefaultEnd(false, start, end).end).toEqual(end)
  })

  it('fills a missing end with one hour, or one day when all-day', () => {
    expect(withDefaultEnd(false, start, null).end).toEqual(new Date(2026, 9, 26, 10))
    expect(withDefaultEnd(true, new Date(2026, 9, 26), null).end).toEqual(new Date(2026, 9, 27))
  })
})
