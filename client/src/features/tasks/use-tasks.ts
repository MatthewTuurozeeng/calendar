import { useCallback, useEffect, useState } from 'react'
import { fetchTasks, taskChanges, type Task } from './api'

export type TasksState =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'ready'; tasks: Task[] }

/** Loads tasks and reloads after any task write. */
export function useTasks() {
  const [state, setState] = useState<TasksState>({ status: 'loading' })
  const [attempt, setAttempt] = useState(0)
  const reload = useCallback(() => setAttempt((n) => n + 1), [])

  useEffect(() => {
    let cancelled = false
    fetchTasks().then(
      (tasks) => !cancelled && setState({ status: 'ready', tasks }),
      (err: unknown) =>
        !cancelled &&
        setState({ status: 'error', message: err instanceof Error ? err.message : 'Could not load tasks.' }),
    )
    return () => {
      cancelled = true
    }
  }, [attempt])

  useEffect(() => {
    taskChanges.addEventListener('change', reload)
    return () => taskChanges.removeEventListener('change', reload)
  }, [reload])

  return { state, reload }
}
