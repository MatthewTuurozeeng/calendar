import { describe, expect, it } from 'vitest'
import { daySummary, formatMinutes, freeGaps } from '../../src/features/dashboard/today'
import type { Occurrence } from '../../src/features/recurrence/expand'

const at = (time: string) => new Date(`2026-10-29T${time}:00`)

function occurrence(start: string, end: string, extra: Partial<Occurrence> = {}): Occurrence {
  return {
    key: start,
    timing: { allDay: false, start: at(start), end: at(end) },
    title: 'Event',
    ...extra,
  } as Occurrence
}

const allDay = { key: 'all-day', timing: { allDay: true, start: at('00:00'), end: at('23:59') } } as Occurrence

describe('freeGaps', () => {
  const dayStart = at('08:00')
  const dayEnd = at('22:00')

  it('finds the gaps between events, from now until the end of the day', () => {
    const events = [occurrence('09:00', '10:00'), occurrence('12:00', '13:00')]
    const gaps = freeGaps(events, dayStart, dayEnd, at('07:00'))
    expect(gaps.map((g) => [g.start, g.end, g.minutes])).toEqual([
      [at('08:00'), at('09:00'), 60],
      [at('10:00'), at('12:00'), 120],
      [at('13:00'), at('22:00'), 540],
    ])
  })

  it('starts from now once the day is under way', () => {
    const gaps = freeGaps([occurrence('12:00', '13:00')], dayStart, dayEnd, at('11:15'))
    expect(gaps[0]).toEqual({ start: at('11:15'), end: at('12:00'), minutes: 45 })
  })

  it('merges overlapping events and ignores all-day ones', () => {
    const events = [occurrence('09:00', '11:00'), occurrence('10:00', '12:00'), occurrence('10:30', '10:45'), allDay]
    const gaps = freeGaps(events, dayStart, at('14:00'), at('08:00'))
    expect(gaps.map((g) => [g.start, g.end])).toEqual([
      [at('08:00'), at('09:00')],
      [at('12:00'), at('14:00')],
    ])
  })

  it('drops gaps shorter than the minimum', () => {
    const events = [occurrence('08:20', '09:00'), occurrence('09:15', '21:50')]
    expect(freeGaps(events, dayStart, dayEnd, at('08:00'))).toEqual([])
  })

  it('is empty after the end of the day', () => {
    expect(freeGaps([], dayStart, dayEnd, at('22:30'))).toEqual([])
  })

  it('handles an event running past the end of the day', () => {
    const gaps = freeGaps([occurrence('20:00', '23:00')], dayStart, dayEnd, at('19:00'))
    expect(gaps.map((g) => g.minutes)).toEqual([60])
  })
})

describe('daySummary', () => {
  it('counts finished events, focus time and tasks', () => {
    const task = { id: 't1', status: 'pending' }
    const events = [
      occurrence('09:00', '10:00'),
      occurrence('11:00', '12:00'),
      occurrence('13:00', '14:30', { task }),
      occurrence('15:00', '15:45', { task }),
      allDay,
    ]
    expect(daySummary(events, { dueToday: 3, doneToday: 2, overdue: 1 }, at('11:30'))).toEqual({
      tasksDone: 2,
      tasksPlanned: 5,
      overdue: 1,
      eventsDone: 1,
      eventsPlanned: 2,
      focusMinutes: 135,
    })
  })
})

describe('formatMinutes', () => {
  it('formats minutes and hours', () => {
    expect(formatMinutes(45)).toBe('45m')
    expect(formatMinutes(120)).toBe('2h')
    expect(formatMinutes(90)).toBe('1h 30m')
  })
})
