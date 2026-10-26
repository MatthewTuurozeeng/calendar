import { useState } from 'react'
import { CheckIcon } from '../../components/ui/icons'
import { useUserData } from '../auth/user-data'
import { calendarPrefs, formatOffset } from '../settings/prefs'
import { setTaskStatus, type Task } from './api'
import { dueLabel, taskView } from './views'

type TaskItemProps = {
  task: Task
  now: Date
  onOpen: (task: Task) => void
  onError: (message: string) => void
  /** Hide the due label, e.g. under a heading that already names the day. */
  hideDue?: boolean
}

/** One row in a task list: a completion checkbox and the task's details. */
export function TaskItem({ task, now, onOpen, onError, hideDue }: TaskItemProps) {
  const { profile, allCategories } = useUserData()
  // Shows the tick at once; the list moves the task after the reload.
  const [optimisticDone, setOptimisticDone] = useState<boolean | null>(null)

  const done = optimisticDone ?? task.status === 'completed'
  const overdue = !done && taskView(task, now) === 'overdue'
  const category = allCategories.find((c) => c.id === task.category_id)
  const timeFormat = calendarPrefs(profile).time_format === '24h' ? 'HH:mm' : 'h:mm a'
  const due = hideDue ? null : dueLabel(task, now, timeFormat)
  const subtasksDone = task.task_subtasks.filter((s) => s.is_completed).length

  async function toggle() {
    const next = !done
    setOptimisticDone(next)
    try {
      // Reopening goes back to "to do".
      await setTaskStatus(task.id, next ? 'completed' : 'pending')
    } catch (err) {
      setOptimisticDone(null)
      onError(err instanceof Error ? err.message : 'Could not update the task.')
    }
  }

  return (
    <div className="flex items-start gap-1 px-2 hover:bg-canvas sm:px-3">
      <button
        type="button"
        role="checkbox"
        aria-checked={done}
        aria-label={done ? `Reopen ${task.title}` : `Complete ${task.title}`}
        onClick={toggle}
        className="grid min-h-14 min-w-11 shrink-0 place-items-center"
      >
        <span
          className={`grid size-5 place-items-center rounded-full border-2 transition-colors ${
            done
              ? 'border-ink bg-ink text-surface'
              : task.priority === 'high'
                ? 'border-dusty-orange'
                : 'border-ink-muted/60 hover:border-ink'
          }`}
        >
          {done && <CheckIcon className="size-3.5" strokeWidth={3} />}
        </span>
      </button>

      <button type="button" onClick={() => onOpen(task)} className="min-w-0 flex-1 py-3 pr-1 text-left">
        <span className={`block font-medium break-words ${done ? 'text-ink-muted line-through' : ''}`}>
          {task.title}
        </span>
        <span className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-ink-muted empty:hidden">
          {due && <span className={overdue ? 'font-medium text-danger' : ''}>{due}</span>}
          {task.status === 'in_progress' && !done && (
            <span className="rounded-full bg-periwinkle/35 px-2 text-xs font-medium text-ink">In progress</span>
          )}
          {task.priority === 'high' && !done && (
            <span className="rounded-full bg-dusty-orange/25 px-2 text-xs font-medium text-ink">High priority</span>
          )}
          {task.priority === 'low' && !done && <span>Low priority</span>}
          {task.task_subtasks.length > 0 && (
            <span>
              {subtasksDone}/{task.task_subtasks.length} subtasks
            </span>
          )}
          {task.estimated_minutes && <span>{formatOffset(task.estimated_minutes).replace(/minutes?/, 'min')}</span>}
          {category && (
            <span className="inline-flex items-center gap-1.5">
              <span className="size-2.5 rounded-full" style={{ backgroundColor: category.color }} aria-hidden="true" />
              {category.name}
            </span>
          )}
        </span>
      </button>
    </div>
  )
}
