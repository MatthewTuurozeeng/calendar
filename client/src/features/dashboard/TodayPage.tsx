import { addDays, format, formatDistanceStrict, startOfDay } from 'date-fns'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router'
import { EmptyState } from '../../components/ui/EmptyState'
import { secondaryButtonClass } from '../../components/ui/form'
import { useUserData } from '../auth/user-data'
import { eventChanges, fetchEventsInRange, type EventRow } from '../events/api'
import { EventDialog } from '../events/EventDialog'
import { calendarPrefs, dashboardPrefs } from '../settings/prefs'

const UNCATEGORIZED_COLOR = '#E7E2E0'

type LoadState = { status: 'loading' } | { status: 'error'; message: string } | { status: 'ready'; events: EventRow[] }

/** Re-renders every minute so countdowns and "now" stay current. */
function useNow() {
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 60_000)
    return () => window.clearInterval(timer)
  }, [])
  return now
}

export function TodayPage() {
  const { profile, allCategories } = useUserData()
  const now = useNow()
  const [state, setState] = useState<LoadState>({ status: 'loading' })
  const [editing, setEditing] = useState<EventRow | null>(null)

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

  if (!sections.next_event && !sections.timeline) {
    return (
      <EmptyState
        title="Your Today page is empty"
        description="Turn on the sections you want in Settings, under Today page."
      />
    )
  }

  if (state.status === 'loading') return <p className="text-sm text-ink-muted">Loading today…</p>

  if (state.status === 'error') {
    return (
      <div role="alert" className="rounded-2xl border border-line bg-surface p-5">
        <p className="font-medium">Couldn't load today's events</p>
        <p className="mt-1 text-sm text-ink-muted">{state.message}</p>
        <button type="button" className={`${secondaryButtonClass} mt-4`} onClick={reload}>
          Try again
        </button>
      </div>
    )
  }

  const { events } = state
  const timed = events.filter((e) => !e.all_day)
  const next = timed.find((e) => new Date(e.end_at!) > now)

  const timeRange = (e: EventRow) =>
    e.all_day ? 'All day' : `${format(new Date(e.start_at!), timeFormat)} – ${format(new Date(e.end_at!), timeFormat)}`

  return (
    <div className="flex max-w-3xl flex-col gap-6">
      {sections.next_event && (
        <section aria-labelledby="next-event" className="rounded-2xl border border-line bg-surface p-5">
          <h2 id="next-event" className="text-xs font-semibold tracking-wide text-ink-muted uppercase">
            {next && new Date(next.start_at!) <= now ? 'Happening now' : 'Next up'}
          </h2>
          {next ? (
            <button type="button" onClick={() => setEditing(next)} className="mt-2 block w-full text-left">
              <p className="text-lg font-semibold">{next.title}</p>
              <p className="mt-1 text-sm text-ink-muted">
                {timeRange(next)}
                {next.location && ` · ${next.location}`}
              </p>
              <p className="mt-3 inline-flex rounded-full bg-warm-peach/30 px-3 py-1 text-sm font-medium">
                {new Date(next.start_at!) <= now
                  ? `Ends in ${formatDistanceStrict(new Date(next.end_at!), now)}`
                  : `Starts in ${formatDistanceStrict(new Date(next.start_at!), now)}`}
              </p>
            </button>
          ) : (
            <p className="mt-2 text-ink-muted">Nothing else scheduled today.</p>
          )}
        </section>
      )}

      {sections.timeline && (
        <section aria-labelledby="today-schedule" className="rounded-2xl border border-line bg-surface">
          <header className="flex items-center justify-between gap-4 border-b border-line px-5 py-4">
            <h2 id="today-schedule" className="text-base font-semibold">
              Today's schedule
            </h2>
            <Link to="/calendar" className="text-sm font-medium text-ink-muted underline-offset-4 hover:underline">
              Open calendar
            </Link>
          </header>
          {events.length === 0 ? (
            <p className="px-5 py-8 text-center text-sm text-ink-muted">Nothing scheduled today.</p>
          ) : (
            <ul className="divide-y divide-line">
              {events.map((e) => {
                const past = !e.all_day && new Date(e.end_at!) <= now
                const category = e.category_id ? nameByCategory.get(e.category_id) : undefined
                return (
                  <li key={e.id}>
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
                          backgroundColor: (e.category_id && colorByCategory.get(e.category_id)) || UNCATEGORIZED_COLOR,
                        }}
                        aria-hidden="true"
                      />
                      <span className="min-w-0 flex-1">
                        <span className={`block truncate font-medium ${past ? 'line-through decoration-ink/30' : ''}`}>
                          {e.title}
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
          )}
        </section>
      )}

      {editing && <EventDialog event={editing} onClose={() => setEditing(null)} />}
    </div>
  )
}

async function loadToday(): Promise<LoadState> {
  const start = startOfDay(new Date())
  try {
    const rows = await fetchEventsInRange(start, addDays(start, 1))
    return { status: 'ready', events: sortForDay(rows) }
  } catch (err) {
    return { status: 'error', message: err instanceof Error ? err.message : 'Could not load today.' }
  }
}

/** All-day events first, then timed events by start. */
function sortForDay(rows: EventRow[]): EventRow[] {
  return [...rows].sort((a, b) => {
    if (a.all_day !== b.all_day) return a.all_day ? -1 : 1
    return (a.start_at ?? a.start_date ?? '').localeCompare(b.start_at ?? b.start_date ?? '')
  })
}
