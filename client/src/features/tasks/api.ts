import { supabase } from '../../lib/supabase'
import type { Tables, TablesInsert, TablesUpdate } from '../../types/database'

export type SubtaskRow = Tables<'task_subtasks'>
export type TaskRow = Tables<'tasks'>
export type Task = TaskRow & { task_subtasks: SubtaskRow[] }

export type TaskStatus = 'pending' | 'in_progress' | 'completed'
export type TaskPriority = 'low' | 'medium' | 'high'

/** How many completed tasks to load; older ones stay in the database. */
const COMPLETED_LIMIT = 20

/** Fires 'change' after any task write, so open views can refetch. */
export const taskChanges = new EventTarget()

function notifyChange() {
  taskChanges.dispatchEvent(new Event('change'))
}

/** Every open task, plus the most recently completed ones. */
export async function fetchTasks(): Promise<Task[]> {
  const select = '*, task_subtasks(*)'
  const [open, completed] = await Promise.all([
    supabase
      .from('tasks')
      .select(select)
      .neq('status', 'completed')
      .order('position', { referencedTable: 'task_subtasks' }),
    supabase
      .from('tasks')
      .select(select)
      .eq('status', 'completed')
      .order('completed_at', { ascending: false })
      .order('position', { referencedTable: 'task_subtasks' })
      .limit(COMPLETED_LIMIT),
  ])
  const error = open.error ?? completed.error
  if (error) throw error
  return [...(open.data ?? []), ...(completed.data ?? [])]
}

/** Status and completed_at must agree (schema check), so they always change together. */
export function statusColumns(status: TaskStatus): Pick<TaskRow, 'status' | 'completed_at'> {
  return { status, completed_at: status === 'completed' ? new Date().toISOString() : null }
}

export type SubtaskDraft = { id?: string; title: string; is_completed: boolean }

export async function createTask(values: TablesInsert<'tasks'>, subtasks: SubtaskDraft[] = []) {
  const { data, error } = await supabase.from('tasks').insert(values).select('id').single()
  if (error) throw error
  if (subtasks.length > 0) {
    const { error: subError } = await supabase.from('task_subtasks').insert(
      subtasks.map((s, position) => ({
        user_id: values.user_id,
        task_id: data.id,
        title: s.title,
        is_completed: s.is_completed,
        position,
      })),
    )
    if (subError) throw subError
  }
  notifyChange()
}

/** Updates the task and makes its subtasks match `subtasks` when given. */
export async function updateTask(task: Task, values: TablesUpdate<'tasks'>, subtasks?: SubtaskDraft[]) {
  const { error } = await supabase.from('tasks').update(values).eq('id', task.id)
  if (error) throw error
  if (subtasks) await syncSubtasks(task, subtasks)
  notifyChange()
}

async function syncSubtasks(task: Task, drafts: SubtaskDraft[]) {
  const keep = new Set(drafts.flatMap((d) => (d.id ? [d.id] : [])))
  const removed = task.task_subtasks.filter((s) => !keep.has(s.id)).map((s) => s.id)
  const writes: PromiseLike<{ error: unknown }>[] = []

  if (removed.length > 0) writes.push(supabase.from('task_subtasks').delete().in('id', removed))
  drafts.forEach((d, position) => {
    if (!d.id) {
      writes.push(
        supabase.from('task_subtasks').insert({
          user_id: task.user_id,
          task_id: task.id,
          title: d.title,
          is_completed: d.is_completed,
          position,
        }),
      )
      return
    }
    const before = task.task_subtasks.find((s) => s.id === d.id)
    if (before && (before.title !== d.title || before.is_completed !== d.is_completed || before.position !== position)) {
      writes.push(
        supabase
          .from('task_subtasks')
          .update({ title: d.title, is_completed: d.is_completed, position })
          .eq('id', d.id),
      )
    }
  })

  const results = await Promise.all(writes)
  const failed = results.find((r) => r.error)
  if (failed) throw failed.error
}

export async function setTaskStatus(id: string, status: TaskStatus) {
  const { error } = await supabase.from('tasks').update(statusColumns(status)).eq('id', id)
  if (error) throw error
  notifyChange()
}

export async function setSubtaskCompleted(id: string, isCompleted: boolean) {
  const { error } = await supabase.from('task_subtasks').update({ is_completed: isCompleted }).eq('id', id)
  if (error) throw error
  notifyChange()
}

/** Subtasks go with it; calendar time blocks stay, unlinked (README §4.3). */
export async function deleteTask(id: string) {
  const { error } = await supabase.from('tasks').delete().eq('id', id)
  if (error) throw error
  notifyChange()
}
