import { describe, expect, it } from 'vitest'
import {
  clashesWith,
  defaultSemester,
  findClashes,
  firstClassDate,
  formatMinutesOfDay,
  semesterProgress,
  slotFromEvent,
  weekdayList,
  type ClassSlot,
  type Semester,
} from '../../src/features/academic/timetable'

const slot = (id: string, weekdays: number[], start: string, end: string): ClassSlot => {
  const m = (t: string) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3))
  return { eventId: id, courseId: `c-${id}`, title: id, location: null, weekdays, start: m(start), end: m(end) }
}

const semester = (id: string, start: string, end: string, archived = false): Semester =>
  ({ id, name: id, start_date: start, end_date: end, archived_at: archived ? '2026-01-01T00:00:00Z' : null }) as Semester

describe('slotFromEvent', () => {
  it('reads weekdays from the rule and local times from the first occurrence', () => {
    const s = slotFromEvent({
      id: 'e1',
      course_id: 'c1',
      title: 'CS 301 Lecture',
      location: 'Room 4',
      start_at: new Date('2026-09-07T09:00:00').toISOString(),
      end_at: new Date('2026-09-07T10:30:00').toISOString(),
      rrule: 'FREQ=WEEKLY;BYDAY=MO,WE;UNTIL=20261204T235959Z',
    })
    expect(s).toMatchObject({ weekdays: [1, 3], start: 540, end: 630, courseId: 'c1' })
  })

  it('ignores rows without a course or a time', () => {
    expect(slotFromEvent({ id: 'e', course_id: null, title: '', location: null, start_at: null, end_at: null, rrule: null })).toBeNull()
  })
})

describe('clashes', () => {
  const lecture = slot('lecture', [1, 3], '09:00', '10:30')
  const lab = slot('lab', [3], '10:00', '12:00')
  const tutorial = slot('tutorial', [1], '10:30', '11:30')

  it('finds slots that share a day and overlap in time', () => {
    const clashes = findClashes([lecture, lab, tutorial])
    expect(clashes).toHaveLength(1)
    expect(clashes[0]).toMatchObject({ a: lecture, b: lab, weekdays: [3] })
  })

  it('treats back-to-back classes as no clash', () => {
    expect(findClashes([lecture, tutorial])).toEqual([])
  })

  it('checks a proposed time against the timetable', () => {
    expect(clashesWith({ weekdays: [1, 5], start: 600, end: 660 }, [lecture, lab, tutorial])).toEqual([lecture, tutorial])
  })
})

describe('firstClassDate', () => {
  it('finds the first matching weekday on or after the semester start', () => {
    // 2026-09-02 is a Wednesday.
    expect(firstClassDate('2026-09-02', '2026-12-04', [1])).toBe('2026-09-07')
    expect(firstClassDate('2026-09-02', '2026-12-04', [3, 5])).toBe('2026-09-02')
  })

  it('returns null when no day in range matches', () => {
    expect(firstClassDate('2026-09-07', '2026-09-08', [5])).toBeNull()
  })
})

describe('defaultSemester', () => {
  const past = semester('past', '2026-01-10', '2026-05-01')
  const current = semester('current', '2026-09-01', '2026-12-15')
  const next = semester('next', '2027-01-10', '2027-05-01')

  it('prefers the semester running today', () => {
    expect(defaultSemester([next, current, past], '2026-10-29')?.id).toBe('current')
  })

  it('falls back to the next one, then the latest', () => {
    expect(defaultSemester([next, past], '2026-10-29')?.id).toBe('next')
    expect(defaultSemester([past], '2026-10-29')?.id).toBe('past')
  })

  it('skips archived semesters while others exist', () => {
    const archived = semester('archived', '2026-09-01', '2026-12-15', true)
    expect(defaultSemester([archived, next], '2026-10-29')?.id).toBe('next')
  })
})

describe('semesterProgress', () => {
  const s = semester('s', '2026-09-07', '2026-12-18')
  it('describes where today falls', () => {
    expect(semesterProgress(s, '2026-09-07')).toBe('Week 1 of 15')
    expect(semesterProgress(s, '2026-10-29')).toBe('Week 8 of 15')
    expect(semesterProgress(s, '2026-09-06')).toBe('Starts tomorrow')
    expect(semesterProgress(s, '2026-12-19')).toBe('Ended')
  })
})

describe('formatting', () => {
  it('lists weekdays Monday first', () => {
    expect(weekdayList([0, 3, 1])).toBe('Mon, Wed, Sun')
  })

  it('formats times of day', () => {
    expect(formatMinutesOfDay(540, true)).toBe('09:00')
    expect(formatMinutesOfDay(810, false)).toBe('1:30 pm')
    expect(formatMinutesOfDay(30, false)).toBe('12:30 am')
  })
})
