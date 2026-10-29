import { addDays } from 'date-fns'
import { parseLocal, toDateString } from '../../lib/dates'
import type { Tables } from '../../types/database'
import { parseRule } from '../recurrence/rule'

// Pure timetable logic for the Academic Planner (README §4.8): weekly class
// slots, clash detection and semester helpers.

export type Semester = Tables<'semesters'>

/** A weekly class time, read from its series row. Times are minutes after midnight. */
export type ClassSlot = {
  eventId: string
  courseId: string
  title: string
  location: string | null
  /** 0 = Sunday … 6 = Saturday. */
  weekdays: number[]
  start: number
  end: number
}

type ClassRow = Pick<Tables<'events'>, 'id' | 'course_id' | 'title' | 'location' | 'start_at' | 'end_at' | 'rrule'>

const minutesOf = (d: Date) => d.getHours() * 60 + d.getMinutes()

/** The slot a class series describes, or null for a row that isn't a timed weekly class. */
export function slotFromEvent(row: ClassRow): ClassSlot | null {
  if (!row.course_id || !row.start_at || !row.end_at) return null
  const start = new Date(row.start_at)
  const weekdays = row.rrule ? parseRule(row.rrule).weekdays : []
  return {
    eventId: row.id,
    courseId: row.course_id,
    title: row.title,
    location: row.location,
    weekdays: weekdays.length > 0 ? weekdays : [start.getDay()],
    start: minutesOf(start),
    end: minutesOf(new Date(row.end_at)),
  }
}

type SlotTimes = Pick<ClassSlot, 'weekdays' | 'start' | 'end'>

/** Shared weekdays on which two slots overlap in time. */
export function clashDays(a: SlotTimes, b: SlotTimes): number[] {
  if (a.start >= b.end || b.start >= a.end) return []
  return a.weekdays.filter((d) => b.weekdays.includes(d))
}

export type Clash = { a: ClassSlot; b: ClassSlot; weekdays: number[] }

/** Every pair of slots in a timetable that overlaps. */
export function findClashes(slots: ClassSlot[]): Clash[] {
  const clashes: Clash[] = []
  for (let i = 0; i < slots.length; i++) {
    for (let j = i + 1; j < slots.length; j++) {
      const weekdays = clashDays(slots[i], slots[j])
      if (weekdays.length > 0) clashes.push({ a: slots[i], b: slots[j], weekdays })
    }
  }
  return clashes
}

/** The slots a proposed class time would overlap. */
export function clashesWith(proposed: SlotTimes, slots: ClassSlot[]): ClassSlot[] {
  return slots.filter((s) => clashDays(proposed, s).length > 0)
}

/** The first date on or after `from` that falls on one of `weekdays`, or null if there's none by `until`. */
export function firstClassDate(from: string, until: string, weekdays: number[]): string | null {
  for (let d = parseLocal(from); toDateString(d) <= until; d = addDays(d, 1)) {
    if (weekdays.includes(d.getDay())) return toDateString(d)
  }
  return null
}

/** The semester running today, else the next one, else the latest; archived ones only as a last resort. */
export function defaultSemester(semesters: Semester[], today: string): Semester | undefined {
  const active = semesters.filter((s) => !s.archived_at)
  const pool = active.length > 0 ? active : semesters
  return (
    pool.find((s) => s.start_date <= today && today <= s.end_date) ??
    [...pool].filter((s) => s.start_date > today).sort((a, b) => a.start_date.localeCompare(b.start_date))[0] ??
    [...pool].sort((a, b) => b.end_date.localeCompare(a.end_date))[0]
  )
}

/** "Week 3 of 15", "Starts in 12 days" or "Ended". */
export function semesterProgress(semester: Semester, today: string): string {
  const start = parseLocal(semester.start_date)
  const end = parseLocal(semester.end_date)
  const now = parseLocal(today)
  const totalWeeks = Math.max(1, Math.ceil((end.getTime() - start.getTime() + 86_400_000) / (7 * 86_400_000)))
  if (now < start) {
    const days = Math.round((start.getTime() - now.getTime()) / 86_400_000)
    return days === 1 ? 'Starts tomorrow' : `Starts in ${days} days`
  }
  if (now > end) return 'Ended'
  const week = Math.floor((now.getTime() - start.getTime()) / (7 * 86_400_000)) + 1
  return `Week ${week} of ${totalWeeks}`
}

const SHORT_DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

/** Weekdays in timetable order (Monday first): "Mon, Wed". */
export function weekdayList(weekdays: number[]): string {
  return [...weekdays]
    .sort((a, b) => ((a + 6) % 7) - ((b + 6) % 7))
    .map((d) => SHORT_DAYS[d])
    .join(', ')
}

/** "09:00" or "9:00 am" for minutes after midnight. */
export function formatMinutesOfDay(minutes: number, use24h: boolean): string {
  const h = Math.floor(minutes / 60)
  const m = String(minutes % 60).padStart(2, '0')
  if (use24h) return `${String(h).padStart(2, '0')}:${m}`
  return `${h % 12 || 12}:${m} ${h < 12 ? 'am' : 'pm'}`
}
