import { useEffect, useState } from 'react'
import { parseLocal } from '../../lib/dates'
import { supabase } from '../../lib/supabase'
import type { Tables, TablesInsert, TablesUpdate } from '../../types/database'
import { createEvent, notifyChange as notifyEventChange, type EventRow } from '../events/api'
import { scheduleColumns } from '../recurrence/api'
import { createTask, taskChanges, type TaskPriority } from '../tasks/api'
import { firstClassDate, type Semester } from './timetable'

// Academic Planner data (README §4.8). Classes, quizzes and exams are ordinary
// events with course_id set; assignments are ordinary tasks with course_id set.

export type Course = Tables<'courses'>
export type { Semester }

/** Fires 'change' after any semester or course write. */
export const academicChanges = new EventTarget()
const notify = () => academicChanges.dispatchEvent(new Event('change'))

/** Deleting a semester or course cascades to its events and tasks, so every view refreshes. */
function notifyAll() {
  notify()
  notifyEventChange()
  taskChanges.dispatchEvent(new Event('change'))
}

// ---------- Semesters ----------

export async function fetchSemesters(): Promise<Semester[]> {
  const { data, error } = await supabase.from('semesters').select('*').order('start_date', { ascending: false })
  if (error) throw error
  return data
}

export async function createSemester(values: TablesInsert<'semesters'>): Promise<Semester> {
  const { data, error } = await supabase.from('semesters').insert(values).select().single()
  if (error) throw error
  notify()
  return data
}

export async function updateSemester(id: string, values: TablesUpdate<'semesters'>) {
  const { error } = await supabase.from('semesters').update(values).eq('id', id)
  if (error) throw error
  notify()
}

/** Removes the semester with its courses, classes, quizzes, exams and assignments. */
export async function deleteSemester(id: string) {
  const { error } = await supabase.from('semesters').delete().eq('id', id)
  if (error) throw error
  notifyAll()
}

// ---------- Courses ----------

export async function fetchCourses(semesterId: string): Promise<Course[]> {
  const { data, error } = await supabase.from('courses').select('*').eq('semester_id', semesterId).order('code')
  if (error) throw error
  return data
}

function friendly(error: { code?: string; message: string }): Error {
  return new Error(error.message)
}

export async function createCourse(values: TablesInsert<'courses'>) {
  const { error } = await supabase.from('courses').insert(values)
  if (error) throw friendly(error)
  notify()
}

export async function updateCourse(id: string, values: TablesUpdate<'courses'>) {
  const { error } = await supabase.from('courses').update(values).eq('id', id)
  if (error) throw friendly(error)
  notify()
}

export async function deleteCourse(id: string) {
  const { error } = await supabase.from('courses').delete().eq('id', id)
  if (error) throw error
  notifyAll()
}

/** Every course's color, for tinting academic events on the calendar. */
export function useCourseColors(): Map<string, string> {
  const [colors, setColors] = useState(() => new Map<string, string>())
  useEffect(() => {
    let cancelled = false
    const load = () =>
      void supabase
        .from('courses')
        .select('id, color')
        .then(({ data }) => {
          if (!cancelled && data) setColors(new Map(data.filter((c) => c.color).map((c) => [c.id, c.color!])))
        })
    load()
    academicChanges.addEventListener('change', load)
    return () => {
      cancelled = true
      academicChanges.removeEventListener('change', load)
    }
  }, [])
  return colors
}

// ---------- Classes, quizzes, exams and assignments ----------

/** The weekly class series of these courses. */
export async function fetchClassEvents(courseIds: string[]): Promise<EventRow[]> {
  if (courseIds.length === 0) return []
  const { data, error } = await supabase
    .from('events')
    .select('*')
    .in('course_id', courseIds)
    .eq('kind', 'class')
    .order('start_at')
  if (error) throw error
  return data
}

type Owner = { userId: string; course: Course; timeZone: string; categoryId: string | null }

export type ClassTimeInput = {
  label: string
  weekdays: number[]
  startTime: string
  endTime: string
  location: string
  reminderOffsets: number[]
}

/** Creates one weekly series that runs from the semester's first matching day to its last day. */
export async function createClassTime(owner: Owner, semester: Semester, input: ClassTimeInput) {
  const date = firstClassDate(semester.start_date, semester.end_date, input.weekdays)
  if (!date) throw new Error('None of those weekdays fall inside the semester.')
  const timing = { allDay: false, start: parseLocal(date, input.startTime), end: parseLocal(date, input.endTime) }
  const repeat = {
    freq: 'weekly' as const,
    interval: 1,
    weekdays: input.weekdays,
    monthlyBy: 'date' as const,
    end: { kind: 'until' as const, date: semester.end_date },
  }
  await createEvent({
    user_id: owner.userId,
    course_id: owner.course.id,
    category_id: owner.categoryId,
    kind: 'class',
    title: `${owner.course.code} ${input.label}`.trim(),
    location: input.location.trim() || owner.course.venue,
    timezone: owner.timeZone,
    reminder_offsets: input.reminderOffsets,
    ...scheduleColumns(timing, repeat, owner.timeZone),
  })
}

export type AssessmentInput = {
  kind: 'quiz' | 'exam'
  title: string
  date: string
  startTime: string
  endTime: string
  location: string
  reminderOffsets: number[]
}

export async function createAssessment(owner: Owner, input: AssessmentInput) {
  const timing = { allDay: false, start: parseLocal(input.date, input.startTime), end: parseLocal(input.date, input.endTime) }
  await createEvent({
    user_id: owner.userId,
    course_id: owner.course.id,
    category_id: owner.categoryId,
    kind: input.kind,
    title: `${owner.course.code} ${input.title}`.trim(),
    location: input.location.trim() || null,
    timezone: owner.timeZone,
    reminder_offsets: input.reminderOffsets,
    ...scheduleColumns(timing, null, owner.timeZone),
  })
}

export type AssignmentInput = {
  title: string
  dueDate: string
  /** 'HH:mm', or empty for due on the day. */
  dueTime: string
  priority: TaskPriority
  reminderOffsets: number[]
}

export async function createAssignment(owner: Owner, input: AssignmentInput) {
  await createTask({
    user_id: owner.userId,
    course_id: owner.course.id,
    category_id: owner.categoryId,
    title: `${owner.course.code}: ${input.title.trim()}`,
    priority: input.priority,
    due_date: input.dueTime ? null : input.dueDate,
    due_at: input.dueTime ? parseLocal(input.dueDate, input.dueTime).toISOString() : null,
    reminder_offsets: input.reminderOffsets,
  })
}
