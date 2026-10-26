import { addDays, format, formatDistanceStrict, startOfDay } from 'date-fns'
import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import { Link } from 'react-router'
import { EmptyState } from '../../components/ui/EmptyState'
import { secondaryButtonClass } from '../../components/ui/form'
import { PlusIcon, RepeatIcon } from '../../components/ui/icons'
import { toDateString } from '../../lib/dates'
import { useNow } from '../../lib/use-now'
import { useUserData } from '../auth/user-data'
import { eventChanges } from '../events/api'
import { EventDialog } from '../events/EventDialog'
import { fetchOccurrences } from '../recurrence/api'
import type { Occurrence } from '../recurrence/expand'
import { calendarPrefs, dashboardPrefs } from '../settings/prefs'
import type { Task } from '../tasks/api'
import { TaskDialog } from '../tasks/TaskDialog'
import { TaskItem } from '../tasks/TaskItem'
import { useTasks } from '../tasks/use-tasks'
import { tasksForView } from '../tasks/views'

const UNCATEGORIZED_COLOR = '#E7E2E0'

type LoadState =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'ready'; events: Occurrence[] }

export function TodayPage() {
  const { profile, allCategories } = useUserData()
  const now = useNow()
  const [state, setState] = useState<LoadState>({ status: 'loading' })
  const [editing, setEditing] = useState<Occurrence | null>(null)
  const { state: tasksState, reload: reloadTasks } = useTasks()
  const [taskDialog, setTaskDialog] = useState<{ task?: Task } | null>(null)
  const [taskError, setTaskError] = useState<string | null>(null)

  const sections = dashboardPrefs(profile)
  const timeFormat = calendarPrefs(profile).time_format === '24h' ? 'HH:mm' : 'h:mm a'
  const dayKey = format(now, 'yyyy-MM-dd')

  const colorByCategory = useMemo(() => new Map(allCategories.map((c) => [c.id, c.color])), [allCategories])
  const nameByCategory = useMemo(() => new Map(allCategories.map((c) => [c.id, c.name])), [allCategories])

  const [attempt, setAttempt] = useState(0)
  const reload = useCallback(() => setAttempt((n) => n + 1), [])

  // Reload when the date rolls over and after any event write, including quick-add.
  useEffect(() => {
    let cancelled = false
    void loadToday().then((next) => {
      if (!cancelled) setState(next)
    })
    return () => {
      cancelled = true
    }
  }, [dayKey, attempt])
  useEffect(() => {
    eventChanges.addEventListener('change', reload)
    return () => eventChanges.removeEventListener('change', reload)
  }, [reload])

  if (!sections.next_event && !sections.timeline && !sections.tasks) {
    return (
      <EmptyState
        title="Your Today page is empty"
        description="Turn on the sections you want in Settings, under Today page."
      />
    )
  }

  const events = state.status === 'ready' ? state.events : []
  const next = events.find((e) => !e.timing.allDay && e.timing.end > now)

  const timeRange = ({ timing }: Occurrence) =>
    timing.allDay ? 'All day' : `${format(timing.start, timeFormat)} – ${format(timing.end, timeFormat)}`

  const eventsStatus =
    state.status === 'loading' ? (
      <p className="px-5 py-6 text-sm text-ink-muted">Loading…</p>
    ) : state.status === 'error' ? (
      <LoadError message={state.message} onRetry={reload} />
    ) : null

  const allTasks = tasksState.status === 'ready' ? tasksState.tasks : []
  const overdueTasks = tasksForView(allTasks, 'overdue', now)
  const todayTasks = tasksForView(allTasks, 'today', now)
  // Tasks finished today, so ticking one off doesn't make it vanish.
  const doneToday = tasksForView(allTasks, 'completed', now).filter(
    (t) => t.completed_at && toDateString(new Date(t.completed_at)) === toDateString(now),
  )
  const taskRow = (t: Task) => (
    <li key={`${t.id}:${t.status}`}>
      <TaskItem task={t} now={now} onOpen={(task) => setTaskDialog({ task })} onError={setTaskError} />
    </li>
  )

  return (
    <div className="flex max-w-3xl flex-col gap-6">
      {sections.next_event && (
        <section aria-labelledby="next-event" className="rounded-2xl border border-line bg-surface">
          {eventsStatus ?? (
            <div className="p-5">
              <h2 id="next-event" className="text-xs font-semibold tracking-wide text-ink-muted uppercase">
                {next && next.timing.start <= now ? 'Happening now' : 'Next up'}
              </h2>
              {next ? (
                <button type="button" onClick={() => setEditing(next)} className="mt-2 block w-full text-left">
                  <p className="text-lg font-semibold">{next.title}</p>
                  <p className="mt-1 text-sm text-ink-muted">
                    {timeRange(next)}
                    {next.location && ` · ${next.location}`}
                  </p>
                  <p className="mt-3 inline-flex rounded-full bg-warm-peach/30 px-3 py-1 text-sm font-medium">
                    {next.timing.start <= now
                      ? `Ends in ${formatDistanceStrict(next.timing.end, now)}`
                      : `Starts in ${formatDistanceStrict(next.timing.start, now)}`}
                  </p>
                </button>
              ) : (
                <p className="mt-2 text-ink-muted">Nothing else scheduled today.</p>
              )}
            </div>
          )}
        </section>
      )}

      {sections.tasks && (
        <Card
          id="today-tasks"
          title="Tasks"
          action={
            <Link to="/tasks" className="text-sm font-medium text-ink-muted underline-offset-4 hover:underline">
              All tasks
            </Link>
          }
        >
          {taskError && (
            <p role="alert" className="border-b border-line bg-warm-peach/25 px-5 py-2 text-sm">
              {taskError}
            </p>
          )}
          {tasksState.status === 'loading' && <p className="px-5 py-6 text-sm text-ink-muted">Loading…</p>}
          {tasksState.status === 'error' && <LoadError message={tasksState.message} onRetry={reloadTasks} />}
          {tasksState.status === 'ready' && (
            <>
              {overdueTasks.length > 0 && (
                <>
                  <h3 className="border-b border-line bg-canvas/60 px-5 py-2 text-xs font-semibold tracking-wide text-danger uppercase">
                    Overdue
                  </h3>
                  <ul className="divide-y divide-line border-b border-line">{overdueTasks.map(taskRow)}</ul>
                </>
              )}
              {overdueTasks.length > 0 && todayTasks.length > 0 && (
                <h3 className="border-b border-line bg-canvas/60 px-5 py-2 text-xs font-semibold tracking-wide text-ink-muted uppercase">
                  Due today
                </h3>
              )}
              {todayTasks.length > 0 && (
                <ul className="divide-y divide-line border-b border-line">{todayTasks.map(taskRow)}</ul>
              )}
              {overdueTasks.length === 0 && todayTasks.length === 0 && (
                <p className="border-b border-line px-5 py-6 text-center text-sm text-ink-muted">
                  {doneToday.length > 0 ? "Everything due today is done." : 'Nothing due today.'}
                </p>
              )}
              {doneToday.length > 0 && (
                <ul className="divide-y divide-line border-b border-line">{doneToday.map(taskRow)}</ul>
              )}
              <button
                type="button"
                onClick={() => setTaskDialog({})}
                className="flex min-h-12 w-full items-center gap-2 rounded-b-2xl px-5 text-sm font-medium text-ink-muted hover:bg-canvas hover:text-ink"
              >
                <PlusIcon className="size-5" />
                Add a task for today
              </button>
            </>
          )}
        </Card>
      )}

      {sections.timeline && (
        <Card
          id="today-schedule"
          title="Today's schedule"
          action={
            <Link to="/calendar" className="text-sm font-medium text-ink-muted underline-offset-4 hover:underline">
              Open calendar
            </Link>
          }
        >
          {eventsStatus ??
            (events.length === 0 ? (
              <p className="px-5 py-8 text-center text-sm text-ink-muted">Nothing scheduled today.</p>
            ) : (
              <ul className="divide-y divide-line">
                {events.map((e) => {
                  const past = !e.timing.allDay && e.timing.end <= now
                  const category = e.category_id ? nameByCategory.get(e.category_id) : undefined
                  return (
                    <li key={e.key}>
                      <button
                        type="button"
                        onClick={() => setEditing(e)}
                        className={`flex min-h-14 w-full items-center gap-4 px-5 py-3 text-left hover:bg-canvas ${
                          past ? 'text-ink-muted' : ''
                        }`}
                      >
                        <span className="w-32 shrink-0 text-sm tabular-nums sm:w-36">{timeRange(e)}</span>
                        <span
                          className="h-8 w-1 shrink-0 rounded-full"
                          style={{
                            backgroundColor:
                              (e.category_id && colorByCategory.get(e.category_id)) || UNCATEGORIZED_COLOR,
                          }}
                          aria-hidden="true"
                        />
                        <span className="min-w-0 flex-1">
                          <span
                            className={`flex items-center gap-1.5 font-medium ${past ? 'line-through decoration-ink/30' : ''}`}
                          >
                            <span className="truncate">{e.title}</span>
                            {e.original && (
                              <>
                                <RepeatIcon className="size-3.5 text-ink-muted" />
                                <span className="sr-only">(repeats)</span>
                              </>
                            )}
                          </span>
                          {(category || e.location) && (
                            <span className="block truncate text-sm text-ink-muted">
                              {[category, e.location].filter(Boolean).join(' · ')}
                            </span>
                          )}
                        </span>
                      </button>
                    </li>
                  )
                })}
              </ul>
            ))}
        </Card>
      )}

      {editing && <EventDialog occurrence={editing} onClose={() => setEditing(null)} />}
      {taskDialog && (
        <TaskDialog
          {...(taskDialog.task ? { task: taskDialog.task } : { defaultDueDate: toDateString(now) })}
          onClose={() => setTaskDialog(null)}
        />
      )}
    </div>
  )
}

function Card({ id, title, action, children }: { id: string; title: string; action?: ReactNode; children: ReactNode }) {
  return (
    <section aria-labelledby={id} className="rounded-2xl border border-line bg-surface">
      <header className="flex items-center justify-between gap-4 border-b border-line px-5 py-4">
        <h2 id={id} className="text-base font-semibold">
          {title}
        </h2>
        {action}
      </header>
      {children}
    </section>
  )
}

function LoadError({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div role="alert" className="px-5 py-6">
      <p className="font-medium">Couldn't load this</p>
      <p className="mt-1 text-sm text-ink-muted">{message}</p>
      <button type="button" className={`${secondaryButtonClass} mt-4`} onClick={onRetry}>
        Try again
      </button>
    </div>
  )
}

async function loadToday(): Promise<LoadState> {
  const start = startOfDay(new Date())
  try {
    // Sorted with all-day events first, then by start.
    return { status: 'ready', events: await fetchOccurrences(start, addDays(start, 1)) }
  } catch (err) {
    return { status: 'error', message: err instanceof Error ? err.message : 'Could not load today.' }
  }
}
