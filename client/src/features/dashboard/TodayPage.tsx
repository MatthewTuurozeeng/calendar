import { addDays, addMinutes, format, formatDistanceStrict, roundToNearestMinutes, setHours, startOfDay } from 'date-fns'
import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import { Link } from 'react-router'
import { EmptyState } from '../../components/ui/EmptyState'
import { secondaryButtonClass } from '../../components/ui/form'
import { PlusIcon, RepeatIcon } from '../../components/ui/icons'
import { toDateString } from '../../lib/dates'
import { useNow } from '../../lib/use-now'
import { useUserData } from '../auth/user-data'
import { eventChanges } from '../events/api'
import { useCourseColors } from '../academic/api'
import { EventDialog } from '../events/EventDialog'
import type { EventTiming } from '../events/timing'
import { fetchOccurrences } from '../recurrence/api'
import type { Occurrence } from '../recurrence/expand'
import { calendarPrefs, dashboardPrefs } from '../settings/prefs'
import { taskChanges, type Task } from '../tasks/api'
import { TaskDialog } from '../tasks/TaskDialog'
import { TaskItem } from '../tasks/TaskItem'
import { useTasks } from '../tasks/use-tasks'
import { tasksForView } from '../tasks/views'
import { DailyIntention } from './DailyIntention'
import { daySummary, formatMinutes, freeGaps } from './today'

const UNCATEGORIZED_COLOR = '#E7E2E0'
/** Free time is looked for until this hour. */
const DAY_END_HOUR = 22

type LoadState =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'ready'; events: Occurrence[] }

export function TodayPage() {
  const { profile, allCategories } = useUserData()
  const now = useNow()
  const [state, setState] = useState<LoadState>({ status: 'loading' })
  const [editing, setEditing] = useState<Occurrence | null>(null)
  const [newEvent, setNewEvent] = useState<EventTiming | null>(null)
  const { state: tasksState, reload: reloadTasks } = useTasks()
  const [taskDialog, setTaskDialog] = useState<{ task?: Task } | null>(null)
  const [taskError, setTaskError] = useState<string | null>(null)

  const sections = dashboardPrefs(profile)
  const calPrefs = calendarPrefs(profile)
  const timeFormat = calPrefs.time_format === '24h' ? 'HH:mm' : 'h:mm a'
  const dayKey = format(now, 'yyyy-MM-dd')

  const colorByCategory = useMemo(() => new Map(allCategories.map((c) => [c.id, c.color])), [allCategories])
  const courseColors = useCourseColors()
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
    // Task blocks show their task's completion, so task changes reload events too.
    eventChanges.addEventListener('change', reload)
    taskChanges.addEventListener('change', reload)
    return () => {
      eventChanges.removeEventListener('change', reload)
      taskChanges.removeEventListener('change', reload)
    }
  }, [reload])

  if (!Object.values(sections).some(Boolean)) {
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

  const summary =
    state.status === 'ready' && tasksState.status === 'ready'
      ? daySummary(events, { dueToday: todayTasks.length, doneToday: doneToday.length, overdue: overdueTasks.length }, now)
      : null

  const today = startOfDay(now)
  const dayStart = setHours(today, calPrefs.day_start_hour)
  const dayEnd = setHours(today, Math.max(DAY_END_HOUR, calPrefs.day_start_hour + 1))
  const gaps = freeGaps(events, dayStart, dayEnd, now)

  function planGap(start: Date, end: Date) {
    // Start on a quarter hour, at the default event length if the gap allows.
    const from = roundToNearestMinutes(start, { nearestTo: 15, roundingMethod: 'ceil' })
    const to = addMinutes(from, calPrefs.default_event_minutes)
    setNewEvent({ allDay: false, start: from, end: to < end ? to : end })
  }

  return (
    <div className="flex max-w-3xl flex-col gap-6">
      {sections.intention && <DailyIntention key={dayKey} date={dayKey} />}

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

      {sections.summary && (
        <section aria-labelledby="summary" className="rounded-2xl border border-line bg-surface p-5">
          <h2 id="summary" className="text-xs font-semibold tracking-wide text-ink-muted uppercase">
            Today so far
          </h2>
          {!summary ? (
            state.status === 'error' || tasksState.status === 'error' ? (
              <p className="mt-2 text-sm text-ink-muted">Couldn't load today's progress.</p>
            ) : (
              <p className="mt-2 text-sm text-ink-muted">Loading…</p>
            )
          ) : (
            <>
              <dl className="mt-3 grid grid-cols-3 gap-4">
                <Stat
                  label="Tasks"
                  value={summary.tasksPlanned === 0 ? '–' : `${summary.tasksDone}/${summary.tasksPlanned}`}
                  detail={summary.overdue > 0 ? `${summary.overdue} overdue` : undefined}
                  danger={summary.overdue > 0}
                />
                <Stat
                  label="Events"
                  value={summary.eventsPlanned === 0 ? '–' : `${summary.eventsDone}/${summary.eventsPlanned}`}
                  detail={summary.eventsPlanned > 0 ? 'finished' : undefined}
                />
                <Stat
                  label="Focus time"
                  value={summary.focusMinutes === 0 ? '–' : formatMinutes(summary.focusMinutes)}
                  detail={summary.focusMinutes > 0 ? 'blocked for tasks' : undefined}
                />
              </dl>
              {summary.tasksPlanned > 0 && (
                <div className="mt-4">
                  <div
                    role="progressbar"
                    aria-label="Tasks done today"
                    aria-valuemin={0}
                    aria-valuemax={summary.tasksPlanned}
                    aria-valuenow={summary.tasksDone}
                    className="h-2 overflow-hidden rounded-full bg-canvas"
                  >
                    <div
                      className="h-full rounded-full bg-dusty-orange transition-[width] duration-500"
                      style={{ width: `${(summary.tasksDone / summary.tasksPlanned) * 100}%` }}
                    />
                  </div>
                  <p className="mt-2 text-sm text-ink-muted">
                    {summary.tasksDone === summary.tasksPlanned
                      ? "All of today's tasks are done. Nice work."
                      : `${summary.tasksPlanned - summary.tasksDone} task${summary.tasksPlanned - summary.tasksDone === 1 ? '' : 's'} left for today.`}
                  </p>
                </div>
              )}
            </>
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
                  const past = (!e.timing.allDay && e.timing.end <= now) || e.task?.status === 'completed'
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
                              (e.event.course_id && courseColors.get(e.event.course_id)) ||
                              (e.category_id && colorByCategory.get(e.category_id)) ||
                              UNCATEGORIZED_COLOR,
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
                          {(e.task || category || e.location) && (
                            <span className="block truncate text-sm text-ink-muted">
                              {[e.task && (e.task.status === 'completed' ? 'Task · done' : 'Task'), category, e.location]
                                .filter(Boolean)
                                .join(' · ')}
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

      {sections.free_gaps && (
        <Card id="free-time" title="Free time">
          {eventsStatus ??
            (gaps.length === 0 ? (
              <p className="px-5 py-8 text-center text-sm text-ink-muted">
                {now >= dayEnd ? 'The day is done.' : 'No free stretches of 30 minutes or more left today.'}
              </p>
            ) : (
              <ul className="divide-y divide-line">
                {gaps.map((g) => (
                  <li key={g.start.getTime()}>
                    <button
                      type="button"
                      onClick={() => planGap(g.start, g.end)}
                      className="group flex min-h-14 w-full items-center gap-4 px-5 py-3 text-left hover:bg-canvas"
                    >
                      <span className="w-32 shrink-0 text-sm tabular-nums sm:w-36">
                        {format(g.start, timeFormat)} – {format(g.end, timeFormat)}
                      </span>
                      <span className="h-8 w-1 shrink-0 rounded-full border border-dashed border-ink-muted/50" aria-hidden="true" />
                      <span className="flex-1 font-medium">{formatMinutes(g.minutes)} free</span>
                      <span className="inline-flex items-center gap-1 text-sm text-ink-muted group-hover:text-ink">
                        <PlusIcon className="size-4" />
                        Plan
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            ))}
        </Card>
      )}

      {editing && <EventDialog occurrence={editing} onClose={() => setEditing(null)} />}
      {newEvent && <EventDialog timing={newEvent} onClose={() => setNewEvent(null)} />}
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

function Stat({ label, value, detail, danger }: { label: string; value: string; detail?: string; danger?: boolean }) {
  return (
    <div>
      <dt className="text-sm text-ink-muted">{label}</dt>
      <dd className="mt-1 text-2xl font-semibold tabular-nums">{value}</dd>
      {detail && <dd className={`text-xs ${danger ? 'font-medium text-danger' : 'text-ink-muted'}`}>{detail}</dd>}
    </div>
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
