import { useState, type FormEvent } from 'react'
import { useSearchParams } from 'react-router'
import { inputClass, primaryButtonClass, secondaryButtonClass } from '../../components/ui/form'
import { PlusIcon } from '../../components/ui/icons'
import { useNow } from '../../lib/use-now'
import { useSession } from '../auth/auth-context'
import { useUserData } from '../auth/user-data'
import { createTask, type Task } from './api'
import { TaskDialog } from './TaskDialog'
import { TaskItem } from './TaskItem'
import { useTasks } from './use-tasks'
import {
  countByView,
  defaultDueDate,
  groupByCompletedDay,
  groupByDueDay,
  tasksForView,
  taskViewFromParams,
  TASK_VIEWS,
  type TaskGroup,
  type TaskView,
} from './views'

const EMPTY: Record<TaskView, { title: string; description: string }> = {
  today: { title: 'Nothing due today', description: 'Add a task above, or enjoy the space.' },
  upcoming: { title: 'Nothing coming up', description: 'Tasks due later, and tasks with no date, show up here.' },
  overdue: { title: 'All caught up', description: 'Nothing is past due.' },
  completed: { title: 'No completed tasks yet', description: 'Tick a task off and it moves here.' },
}

const QUICK_ADD_PLACEHOLDER: Partial<Record<TaskView, string>> = {
  today: 'Add a task for today',
  upcoming: 'Add a task for tomorrow',
  overdue: 'Add a task with no date',
}

export function TasksPage() {
  const session = useSession()
  const { categories } = useUserData()
  const now = useNow()
  const { state, reload } = useTasks()
  const [params, setParams] = useSearchParams()
  const view = taskViewFromParams(params)
  const [categoryFilter, setCategoryFilter] = useState('')
  const [priorityFilter, setPriorityFilter] = useState('')
  const [dialog, setDialog] = useState<{ task: Task } | { create: true } | null>(null)
  const [quickTitle, setQuickTitle] = useState('')
  const [error, setError] = useState<string | null>(null)

  const all = state.status === 'ready' ? state.tasks : []
  const filtered = all.filter(
    (t) =>
      (!categoryFilter || (categoryFilter === 'none' ? !t.category_id : t.category_id === categoryFilter)) &&
      (!priorityFilter || t.priority === priorityFilter),
  )
  const counts = countByView(filtered, now)
  const visible = tasksForView(filtered, view, now)

  const groups: TaskGroup<Task>[] =
    view === 'upcoming'
      ? groupByDueDay(visible, now)
      : view === 'completed'
        ? groupByCompletedDay(visible, now)
        : [{ key: view, label: '', tasks: visible }]

  async function handleQuickAdd(e: FormEvent) {
    e.preventDefault()
    const title = quickTitle.trim()
    if (!title) return
    setQuickTitle('')
    try {
      await createTask({
        user_id: session.user.id,
        title,
        due_date: defaultDueDate(view, now),
        category_id: categoryFilter && categoryFilter !== 'none' ? categoryFilter : null,
        priority: priorityFilter || 'medium',
      })
    } catch (err) {
      setQuickTitle(title)
      setError(err instanceof Error ? err.message : 'Could not add the task.')
    }
  }

  const filtersActive = categoryFilter !== '' || priorityFilter !== ''

  return (
    <div className="flex max-w-3xl flex-col gap-4">
      <div className="flex flex-wrap items-center gap-3">
        <div role="group" aria-label="Task view" className="flex w-full rounded-xl bg-line/60 p-1 sm:w-auto">
          {TASK_VIEWS.map(({ id, label }) => (
            <button
              key={id}
              type="button"
              aria-pressed={view === id}
              onClick={() => setParams(id === 'today' ? {} : { view: id }, { replace: true })}
              className={`flex min-h-10 flex-1 items-center justify-center gap-1.5 rounded-lg px-2 text-sm font-medium sm:flex-none sm:px-3 ${
                view === id ? 'bg-surface shadow-sm' : 'text-ink-muted'
              }`}
            >
              {label}
              {id !== 'completed' && counts[id] > 0 && (
                <span
                  className={`min-w-5 rounded-full px-1.5 text-xs tabular-nums ${
                    id === 'overdue' ? 'bg-dusty-orange/40 text-ink' : 'bg-line'
                  }`}
                >
                  {counts[id]}
                </span>
              )}
            </button>
          ))}
        </div>

        <button
          type="button"
          onClick={() => setDialog({ create: true })}
          className={`${primaryButtonClass} ml-auto hidden gap-2 md:inline-flex`}
        >
          <PlusIcon className="size-5" />
          New task
        </button>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <label htmlFor="filter-category" className="sr-only">
          Filter by category
        </label>
        <select
          id="filter-category"
          className={`${inputClass} w-auto min-w-0 flex-1 sm:flex-none`}
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value)}
        >
          <option value="">All categories</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
          <option value="none">No category</option>
        </select>
        <label htmlFor="filter-priority" className="sr-only">
          Filter by priority
        </label>
        <select
          id="filter-priority"
          className={`${inputClass} w-auto min-w-0 flex-1 sm:flex-none`}
          value={priorityFilter}
          onChange={(e) => setPriorityFilter(e.target.value)}
        >
          <option value="">All priorities</option>
          <option value="high">High priority</option>
          <option value="medium">Medium priority</option>
          <option value="low">Low priority</option>
        </select>
        {filtersActive && (
          <button
            type="button"
            className="min-h-11 rounded-xl px-3 text-sm font-medium text-ink-muted hover:bg-surface"
            onClick={() => {
              setCategoryFilter('')
              setPriorityFilter('')
            }}
          >
            Clear filters
          </button>
        )}
      </div>

      {error && (
        <p role="alert" className="flex items-center justify-between gap-3 rounded-xl bg-warm-peach/25 px-3 py-2 text-sm">
          {error}
          <button type="button" className="font-medium underline underline-offset-4" onClick={() => setError(null)}>
            Dismiss
          </button>
        </p>
      )}

      <div className="rounded-2xl border border-line bg-surface">
        {QUICK_ADD_PLACEHOLDER[view] && (
          <form onSubmit={handleQuickAdd} className="flex items-center gap-1 border-b border-line px-2 sm:px-3">
            <span className="grid min-h-14 min-w-11 place-items-center text-ink-muted" aria-hidden="true">
              <PlusIcon className="size-5" />
            </span>
            <label htmlFor="quick-add-task" className="sr-only">
              New task title
            </label>
            <input
              id="quick-add-task"
              value={quickTitle}
              onChange={(e) => setQuickTitle(e.target.value)}
              placeholder={QUICK_ADD_PLACEHOLDER[view]}
              enterKeyHint="done"
              className="min-h-14 min-w-0 flex-1 bg-transparent placeholder:text-ink-muted focus-visible:outline-none"
            />
            {quickTitle.trim() && (
              <button type="submit" className="min-h-10 rounded-lg px-3 text-sm font-medium hover:bg-canvas">
                Add
              </button>
            )}
          </form>
        )}

        {state.status === 'loading' && <p className="px-5 py-8 text-center text-sm text-ink-muted">Loading tasks…</p>}

        {state.status === 'error' && (
          <div role="alert" className="px-5 py-8 text-center">
            <p className="font-medium">Couldn't load your tasks</p>
            <p className="mt-1 text-sm text-ink-muted">{state.message}</p>
            <button type="button" className={`${secondaryButtonClass} mt-4`} onClick={reload}>
              Try again
            </button>
          </div>
        )}

        {state.status === 'ready' && visible.length === 0 && (
          <div className="px-5 py-12 text-center">
            <p className="font-semibold">{filtersActive ? 'No tasks match these filters' : EMPTY[view].title}</p>
            <p className="mx-auto mt-1 max-w-sm text-sm text-ink-muted">
              {filtersActive ? 'Try another category or priority.' : EMPTY[view].description}
            </p>
          </div>
        )}

        {state.status === 'ready' &&
          groups.map((group) => (
            <section key={group.key} aria-label={group.label || undefined}>
              {group.label && (
                <h2 className="border-b border-line bg-canvas/60 px-5 py-2 text-xs font-semibold tracking-wide text-ink-muted uppercase">
                  {group.label}
                </h2>
              )}
              <ul className="divide-y divide-line border-b border-line last:border-b-0">
                {group.tasks.map((t) => (
                  <li key={`${t.id}:${t.status}`}>
                    <TaskItem
                      task={t}
                      now={now}
                      onOpen={(task) => setDialog({ task })}
                      onError={setError}
                      hideDue={view === 'upcoming' && !t.due_at}
                    />
                  </li>
                ))}
              </ul>
            </section>
          ))}
      </div>

      {dialog && (
        <TaskDialog
          {...('task' in dialog ? { task: dialog.task } : { defaultDueDate: defaultDueDate(view, now) })}
          onClose={() => setDialog(null)}
        />
      )}
    </div>
  )
}
