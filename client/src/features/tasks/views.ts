import { addDays, differenceInCalendarDays, endOfDay, format, isSameDay, isSameYear } from 'date-fns'
import { parseLocal, toDateString } from '../../lib/dates'
import type { TaskRow } from './api'

// Which list a task belongs in, and how lists sort and group (README §4.2).

export type TaskView = 'today' | 'upcoming' | 'overdue' | 'completed'

export const TASK_VIEWS: { id: TaskView; label: string }[] = [
  { id: 'today', label: 'Today' },
  { id: 'upcoming', label: 'Upcoming' },
  { id: 'overdue', label: 'Overdue' },
  { id: 'completed', label: 'Completed' },
]

/** The task view in the URL (?view=), so links can open a specific list. */
export function taskViewFromParams(params: URLSearchParams): TaskView {
  const view = params.get('view')
  return TASK_VIEWS.some((v) => v.id === view) ? (view as TaskView) : 'today'
}

type DueColumns = Pick<TaskRow, 'due_at' | 'due_date'>
type SortColumns = DueColumns & Pick<TaskRow, 'status' | 'priority' | 'completed_at' | 'created_at'>

const PRIORITY_RANK: Record<string, number> = { high: 0, medium: 1, low: 2 }

/** When a task is due. A date-only task counts as due at the end of that day. */
export function dueMoment(task: DueColumns): Date | null {
  if (task.due_at) return new Date(task.due_at)
  if (task.due_date) return endOfDay(parseLocal(task.due_date))
  return null
}

/** The view a task appears in; tasks with no due date go under Upcoming. */
export function taskView(task: DueColumns & Pick<TaskRow, 'status'>, now: Date): TaskView {
  if (task.status === 'completed') return 'completed'
  if (task.due_date) {
    const today = toDateString(now)
    if (task.due_date < today) return 'overdue'
    return task.due_date === today ? 'today' : 'upcoming'
  }
  if (task.due_at) {
    const due = new Date(task.due_at)
    if (due < now) return 'overdue'
    return isSameDay(due, now) ? 'today' : 'upcoming'
  }
  return 'upcoming'
}

/** Soonest due first (undated last), then higher priority, then oldest. */
export function compareTasks(a: SortColumns, b: SortColumns): number {
  const da = dueMoment(a)?.getTime() ?? Infinity
  const db = dueMoment(b)?.getTime() ?? Infinity
  if (da !== db) return da - db
  const pa = PRIORITY_RANK[a.priority] ?? 1
  const pb = PRIORITY_RANK[b.priority] ?? 1
  if (pa !== pb) return pa - pb
  return a.created_at.localeCompare(b.created_at)
}

/** The tasks in one view, sorted. Completed tasks show the most recent first. */
export function tasksForView<T extends SortColumns>(tasks: T[], view: TaskView, now: Date): T[] {
  const inView = tasks.filter((t) => taskView(t, now) === view)
  if (view === 'completed') return inView.sort((a, b) => (b.completed_at ?? '').localeCompare(a.completed_at ?? ''))
  return inView.sort(compareTasks)
}

export function countByView(tasks: (DueColumns & Pick<TaskRow, 'status'>)[], now: Date): Record<TaskView, number> {
  const counts: Record<TaskView, number> = { today: 0, upcoming: 0, overdue: 0, completed: 0 }
  for (const t of tasks) counts[taskView(t, now)] += 1
  return counts
}

/** 'Today', 'Tomorrow', 'Yesterday', 'Monday' within a week, else 'Mon 2 Nov' (with the year if not this year). */
export function dayLabel(day: Date, now: Date): string {
  const diff = differenceInCalendarDays(day, now)
  if (diff === 0) return 'Today'
  if (diff === 1) return 'Tomorrow'
  if (diff === -1) return 'Yesterday'
  if (diff > 1 && diff < 7) return format(day, 'EEEE')
  return format(day, isSameYear(day, now) ? 'EEE d MMM' : 'EEE d MMM yyyy')
}

/** 'Today', 'Tomorrow, 3:00 PM', 'Mon 2 Nov', or null with no due date. */
export function dueLabel(task: DueColumns, now: Date, timeFormat = 'h:mm a'): string | null {
  if (task.due_date) return dayLabel(parseLocal(task.due_date), now)
  if (task.due_at) {
    const due = new Date(task.due_at)
    return `${dayLabel(due, now)}, ${format(due, timeFormat)}`
  }
  return null
}

export type TaskGroup<T> = { key: string; label: string; tasks: T[] }

/** Upcoming grouped by due day, with undated tasks last. */
export function groupByDueDay<T extends DueColumns>(tasks: T[], now: Date): TaskGroup<T>[] {
  return groupBy(tasks, (t) => {
    const due = dueMoment(t)
    return due ? { key: toDateString(due), label: dayLabel(due, now) } : { key: 'none', label: 'No due date' }
  })
}

/** Completed grouped by the day they were finished. */
export function groupByCompletedDay<T extends Pick<TaskRow, 'completed_at'>>(tasks: T[], now: Date): TaskGroup<T>[] {
  return groupBy(tasks, (t) => {
    const done = t.completed_at ? new Date(t.completed_at) : now
    return { key: toDateString(done), label: dayLabel(done, now) }
  })
}

function groupBy<T>(tasks: T[], keyOf: (t: T) => { key: string; label: string }): TaskGroup<T>[] {
  const groups: TaskGroup<T>[] = []
  for (const task of tasks) {
    const { key, label } = keyOf(task)
    const last = groups[groups.length - 1]
    if (last?.key === key) last.tasks.push(task)
    else groups.push({ key, label, tasks: [task] })
  }
  return groups
}

/** Default due date for a task created from a view. */
export function defaultDueDate(view: TaskView, now: Date): string | null {
  if (view === 'today') return toDateString(now)
  if (view === 'upcoming') return toDateString(addDays(now, 1))
  return null
}
