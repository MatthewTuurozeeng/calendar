import type { ReactNode } from 'react'
import { Link } from 'react-router'
import {
  ArrowRightIcon,
  BellIcon,
  CalendarPlusIcon,
  CheckIcon,
  LockIcon,
  PhoneIcon,
  RepeatIcon,
  SunIcon,
} from '../../components/ui/icons'
import { LogoMark } from '../../components/ui/Logo'
import { primaryButtonClass, secondaryButtonClass } from '../../components/ui/form'
import { useAuth } from '../auth/auth-context'

// The public front page for signed-out visitors. Everything here is static:
// the "product preview" is drawn with the app's own tokens, not a screenshot,
// so it follows light and dark mode.

const linkClass = 'text-sm text-ink-muted hover:text-ink'
const eyebrowClass = 'font-mono text-xs tracking-wider text-dusty-orange uppercase'

export function LandingPage() {
  const { session } = useAuth()
  const signedIn = !!session

  return (
    <div className="min-h-dvh overflow-x-clip">
      <header className="sticky top-0 z-20 border-b border-line/70 bg-canvas/80 backdrop-blur">
        <nav className="mx-auto flex h-16 max-w-6xl items-center gap-6 px-4 sm:px-6" aria-label="Main">
          <Link to="/welcome" className="flex items-center gap-2.5 font-semibold">
            <LogoMark className="size-7" />
            Calendar
          </Link>
          <div className="ml-4 hidden gap-6 md:flex">
            <a href="#features" className={linkClass}>
              Features
            </a>
            <a href="#engineering" className={linkClass}>
              Under the hood
            </a>
            <a href="#changelog" className={linkClass}>
              Changelog
            </a>
          </div>
          <div className="ml-auto flex items-center gap-2">
            {signedIn ? (
              <Link to="/" className={`${primaryButtonClass} min-h-10 text-sm`}>
                Open calendar
              </Link>
            ) : (
              <>
                <Link to="/sign-in" className={`${linkClass} px-3 py-2 font-medium`}>
                  Sign in
                </Link>
                <Link to="/sign-in?mode=sign-up" className={`${primaryButtonClass} min-h-10 text-sm`}>
                  Get started
                </Link>
              </>
            )}
          </div>
        </nav>
      </header>

      <main>
        {/* ---------- Hero ---------- */}
        <section className="relative">
          <DotGrid />
          <div className="relative mx-auto grid max-w-6xl items-center gap-12 px-4 pt-14 pb-20 sm:px-6 lg:grid-cols-[1fr_1.1fr] lg:pt-24 [&>*]:min-w-0">
            <div>
              <a
                href="#changelog"
                className="inline-flex items-center gap-2 rounded-full border border-line bg-surface px-3 py-1 text-xs text-ink-muted hover:text-ink"
              >
                <span className="size-1.5 rounded-full bg-dusty-orange" aria-hidden="true" />
                <span className="font-mono">v0.2</span> Push reminders and an installable app
              </a>
              <h1 className="mt-6 text-4xl leading-[1.1] font-semibold tracking-tight text-balance sm:text-5xl">
                Plan your week the way you{' '}
                <span className="relative whitespace-nowrap">
                  ship code
                  <span className="absolute inset-x-0 bottom-1 -z-10 h-3 rounded-sm bg-warm-peach/45" aria-hidden="true" />
                </span>
                .
              </h1>
              <p className="mt-5 max-w-xl text-lg text-ink-muted text-pretty">
                A calm calendar and task planner that connects what you need to do, when you'll do it, and how
                the day went. Recurring schedules that behave, tasks you can block onto the calendar, and
                reminders that never go stale.
              </p>
              <div className="mt-8 flex flex-wrap gap-3">
                {signedIn ? (
                  <Link to="/" className={`${primaryButtonClass} gap-2`}>
                    Open your calendar <ArrowRightIcon className="size-4" />
                  </Link>
                ) : (
                  <>
                    <Link to="/sign-in?mode=sign-up" className={`${primaryButtonClass} gap-2`}>
                      Create a free account <ArrowRightIcon className="size-4" />
                    </Link>
                    <Link to="/sign-in" className={secondaryButtonClass}>
                      Sign in
                    </Link>
                  </>
                )}
              </div>
              <p className="mt-6 font-mono text-xs text-ink-muted">
                Works in the browser · Installs on Android, iOS and desktop
              </p>
            </div>

            <ProductPreview />
          </div>
        </section>

        {/* ---------- Stack strip ---------- */}
        <section aria-label="Built with" className="border-y border-line bg-surface">
          <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-center gap-x-8 gap-y-3 px-4 py-6 font-mono text-sm text-ink-muted sm:px-6">
            {['React 19', 'TypeScript', 'Vite', 'Tailwind CSS', 'Supabase', 'Postgres', 'Deno Edge Functions', 'Web Push'].map(
              (name) => (
                <span key={name}>{name}</span>
              ),
            )}
          </div>
        </section>

        {/* ---------- Features ---------- */}
        <section id="features" className="mx-auto max-w-6xl scroll-mt-20 px-4 py-24 sm:px-6">
          <p className={eyebrowClass}>Features</p>
          <h2 className="mt-3 max-w-2xl text-3xl font-semibold tracking-tight text-balance">
            Everything a busy week needs. Nothing it doesn't.
          </h2>
          <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <Feature icon={<SunIcon />} tint="bg-warm-peach/35" title="A daily command center">
              Open the app and see what matters today: the next event, tasks due, and the rest of your
              schedule.
            </Feature>
            <Feature icon={<RepeatIcon />} tint="bg-periwinkle/40" title="Recurrence that behaves">
              Lectures, shifts and workouts as one series. Edit this event, this and following, or all of
              them.
            </Feature>
            <Feature icon={<CalendarPlusIcon />} tint="bg-soft-rose/50" title="Task time-blocking">
              Drop a task onto the calendar to plan when you'll do it. Completion stays on the task.
            </Feature>
            <Feature icon={<BellIcon />} tint="bg-rose-pink/40" title="Reminders that keep up">
              Push notifications on your phone and laptop. Move or delete an event and its reminders follow.
            </Feature>
            <Feature icon={<PhoneIcon />} tint="bg-dusty-orange/30" title="Installable everywhere">
              Add it to your home screen like a native app, with a cached shell that opens instantly.
            </Feature>
            <Feature icon={<LockIcon />} tint="bg-periwinkle/40" title="Private by default">
              Your data is yours. Row-level security on every table means nobody else can read or reference
              it.
            </Feature>
          </div>
        </section>

        {/* ---------- Under the hood ---------- */}
        <section id="engineering" className="scroll-mt-16 border-y border-line bg-surface">
          <div className="mx-auto grid max-w-6xl gap-12 px-4 py-24 sm:px-6 lg:grid-cols-2 [&>*]:min-w-0">
            <div>
              <p className={eyebrowClass}>Under the hood</p>
              <h2 className="mt-3 text-3xl font-semibold tracking-tight text-balance">
                Built like production software, for an audience of one.
              </h2>
              <p className="mt-4 text-ink-muted">
                Calendars are full of edge cases: daylight saving, moved occurrences, retries that fire twice.
                Each one is handled on purpose.
              </p>
              <ul className="mt-8 space-y-5">
                <Detail title="DST-safe recurrence">
                  Series expand in floating wall-clock time, so 10:00 every Monday stays at 10:00 when the clocks
                  change.
                </Detail>
                <Detail title="One row per series">
                  An RRULE plus exceptions for single edits and cancellations. No thousands of copied rows.
                </Detail>
                <Detail title="An idempotent reminder pipeline">
                  A trigger cancels stale reminders inside the same write. A cron worker claims due rows with{' '}
                  <code className="font-mono text-sm">SKIP LOCKED</code>, and idempotency keys mean nothing is
                  sent twice.
                </Detail>
                <Detail title="Ownership enforced in the database">
                  Row-level security and composite foreign keys, so one account can't point at another's rows.
                </Detail>
              </ul>
            </div>

            <div className="flex flex-col gap-4">
              <CodeWindow title="lecture.rrule">
                <Line muted>{'# CS 301: Mon & Wed, 09:00 Accra time, until exams'}</Line>
                <Line>
                  <Key>DTSTART</Key>;TZID=Africa/Accra:<Val>20260907T090000</Val>
                </Line>
                <Line>
                  <Key>RRULE</Key>:FREQ=<Val>WEEKLY</Val>;BYDAY=<Val>MO,WE</Val>;UNTIL=<Val>20261204</Val>
                </Line>
                <Line muted>{'# "this event" edit → one exception row'}</Line>
                <Line>
                  <Key>EXDATE</Key>:<Val>20261014T090000</Val>
                </Line>
              </CodeWindow>

              <CodeWindow title="zsh — npm test">
                <Line>
                  <span className="text-dusty-orange">$</span> npm test
                </Line>
                {['prefs', 'recurrence', 'reminder-plan', 'task-views', 'timing', 'today', 'validation'].map((name) => (
                  <Line key={name}>
                    <span className="text-[#8fc79a]">✓</span> tests/unit/{name}.test.ts
                  </Line>
                ))}
                <Line>&nbsp;</Line>
                <Line>
                  <span className="text-[#a7a2aa]">Tests</span> <span className="text-[#8fc79a]">81 passed</span>
                  <span className="text-[#a7a2aa]"> (81)</span>
                </Line>
              </CodeWindow>
            </div>
          </div>
        </section>

        {/* ---------- Changelog ---------- */}
        <section id="changelog" className="mx-auto max-w-6xl scroll-mt-20 px-4 py-24 sm:px-6">
          <p className={eyebrowClass}>Changelog</p>
          <h2 className="mt-3 text-3xl font-semibold tracking-tight">Shipped in small, daily-driven releases.</h2>
          <ol className="mt-12 grid gap-4 md:grid-cols-4">
            <Release version="v0.1" name="Core" status="shipped">
              Day, week, month and agenda views. Tasks, recurrence and time-blocking.
            </Release>
            <Release version="v0.2" name="Reminders & PWA" status="shipped">
              Web Push reminders, the reminder pipeline, install on any device, light and dark.
            </Release>
            <Release version="v0.3" name="Academic Planner" status="next">
              Semesters, courses and class series, exams, assignments and clash warnings.
            </Release>
            <Release version="v0.4" name="Hardening" status="planned">
              Offline reading, JSON and .ics export, end-to-end tests in CI.
            </Release>
          </ol>
        </section>

        {/* ---------- Final call to action ---------- */}
        <section className="mx-auto max-w-6xl px-4 pb-24 sm:px-6">
          <div className="relative overflow-hidden rounded-3xl border border-line bg-surface px-6 py-14 text-center sm:px-12">
            <div
              className="absolute -top-24 left-1/2 size-72 -translate-x-1/2 rounded-full bg-warm-peach/30 blur-3xl"
              aria-hidden="true"
            />
            <h2 className="relative text-3xl font-semibold tracking-tight text-balance">
              Your week, under version control.
            </h2>
            <p className="relative mx-auto mt-3 max-w-md text-ink-muted">
              Free to use. Set up in under a minute, then install it on your phone.
            </p>
            <div className="relative mt-8 flex flex-wrap justify-center gap-3">
              <Link to={signedIn ? '/' : '/sign-in?mode=sign-up'} className={`${primaryButtonClass} gap-2`}>
                {signedIn ? 'Open your calendar' : 'Get started'} <ArrowRightIcon className="size-4" />
              </Link>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-line">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-6 gap-y-2 px-4 py-8 text-sm text-ink-muted sm:px-6">
          <span className="flex items-center gap-2 font-medium text-ink">
            <LogoMark className="size-5" /> Calendar
          </span>
          <span>Built by Matthew Tuurozeeng</span>
          <span className="font-mono text-xs sm:ml-auto">React · TypeScript · Supabase</span>
        </div>
      </footer>
    </div>
  )
}

// ---------- Hero product preview ----------

type PreviewEvent = {
  day: number
  start: number
  end: number
  title: string
  color: string
  recurring?: boolean
  /** A task blocked onto the calendar. */
  block?: boolean
}

const DAYS = ['Mon 26', 'Tue 27', 'Wed 28', 'Thu 29', 'Fri 30']
const FIRST_HOUR = 8
const HOURS = 7
const HOUR_PX = 44

const PREVIEW_EVENTS: PreviewEvent[] = [
  ...[0, 1, 2, 3, 4].map((day) => ({ day, start: 8.5, end: 9, title: 'Standup', color: 'bg-rose-pink', recurring: true })),
  { day: 0, start: 9.5, end: 11, title: 'CS 301 Lecture', color: 'bg-periwinkle', recurring: true },
  { day: 2, start: 9.5, end: 11, title: 'CS 301 Lecture', color: 'bg-periwinkle', recurring: true },
  { day: 1, start: 10, end: 12.5, title: 'Deep work: API', color: 'bg-dusty-orange', block: true },
  { day: 0, start: 12, end: 13, title: 'Lunch with Ama', color: 'bg-soft-rose' },
  { day: 3, start: 13, end: 14.5, title: 'Gym', color: 'bg-periwinkle', recurring: true },
  { day: 4, start: 11, end: 13, title: 'Ship v0.2', color: 'bg-warm-peach', block: true },
  { day: 3, start: 14.5, end: 15, title: 'Review PR #4', color: 'bg-dusty-orange', block: true },
]

function ProductPreview() {
  return (
    <div className="relative" role="img" aria-label="A preview of the week view with events, recurring classes and scheduled tasks">
      <div
        className="absolute -inset-6 -z-10 rounded-[2rem] bg-gradient-to-br from-warm-peach/35 via-soft-rose/25 to-periwinkle/35 blur-2xl"
        aria-hidden="true"
      />
      <div className="overflow-hidden rounded-2xl border border-line bg-surface shadow-2xl shadow-black/10" aria-hidden="true">
        {/* Window bar */}
        <div className="flex items-center gap-3 border-b border-line px-4 py-3">
          <div className="flex gap-1.5">
            <span className="size-2.5 rounded-full bg-dusty-orange" />
            <span className="size-2.5 rounded-full bg-warm-peach" />
            <span className="size-2.5 rounded-full bg-periwinkle" />
          </div>
          <span className="text-sm font-semibold">October 2026</span>
          <div className="ml-auto flex rounded-lg bg-canvas p-0.5 text-[11px] font-medium">
            <span className="px-2 py-0.5 text-ink-muted">Day</span>
            <span className="rounded-md bg-surface px-2 py-0.5 shadow-sm">Week</span>
            <span className="px-2 py-0.5 text-ink-muted">Month</span>
          </div>
        </div>

        {/* Week grid */}
        <div className="grid grid-cols-[2.25rem_repeat(5,1fr)] text-[10px] sm:text-[11px]">
          <div />
          {DAYS.map((d, i) => (
            <div key={d} className="border-l border-line py-2 text-center text-ink-muted">
              <span className={i === 3 ? 'rounded-full bg-dusty-orange px-1.5 py-0.5 font-semibold text-on-pastel' : ''}>
                {d}
              </span>
            </div>
          ))}

          <div className="relative" style={{ height: HOURS * HOUR_PX }}>
            {Array.from({ length: HOURS }, (_, h) => (
              <span key={h} className="absolute right-1.5 -translate-y-1/2 text-ink-muted" style={{ top: h * HOUR_PX }}>
                {h === 0 ? '' : FIRST_HOUR + h}
              </span>
            ))}
          </div>
          {DAYS.map((d, day) => (
            <div key={d} className="relative border-l border-line" style={{ height: HOURS * HOUR_PX }}>
              {Array.from({ length: HOURS }, (_, h) => (
                <div key={h} className="absolute inset-x-0 border-t border-line/70" style={{ top: h * HOUR_PX }} />
              ))}
              {day === 3 && (
                // Now line on today: 12:50, ten minutes before Gym
                <div className="absolute inset-x-0 z-10 h-0.5 bg-dusty-orange" style={{ top: (12 + 50 / 60 - FIRST_HOUR) * HOUR_PX }}>
                  <span className="absolute -top-[3px] -left-1 size-2 rounded-full bg-dusty-orange" />
                </div>
              )}
              {PREVIEW_EVENTS.filter((e) => e.day === day).map((e) => (
                <div
                  key={e.title + e.start}
                  className={`absolute inset-x-0.5 overflow-hidden rounded-md px-1 py-0.5 leading-tight font-medium text-on-pastel sm:px-1.5 ${e.color} ${
                    e.block ? 'border border-dashed border-on-pastel/40' : ''
                  }`}
                  style={{ top: (e.start - FIRST_HOUR) * HOUR_PX + 1, height: (e.end - e.start) * HOUR_PX - 2 }}
                >
                  <span className="line-clamp-2">
                    {e.block && <span className="mr-0.5 inline-block size-2 rounded-full border border-on-pastel/70 align-middle" />}
                    {e.title}
                    {e.recurring && ' ↻'}
                  </span>
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>

      {/* Floating notification */}
      <div
        className="absolute -top-8 right-2 w-56 sm:w-60 rounded-2xl border border-line bg-surface/95 p-3 shadow-xl shadow-black/10 backdrop-blur sm:-right-4"
        aria-hidden="true"
      >
        <div className="flex items-start gap-2.5">
          <LogoMark className="size-7" />
          <div className="min-w-0 text-xs">
            <p className="flex justify-between gap-2 text-ink-muted">
              <span>Calendar</span>
              <span>now</span>
            </p>
            <p className="mt-0.5 font-semibold">Gym</p>
            <p className="text-ink-muted">In 10 minutes · 1:00 pm</p>
          </div>
        </div>
      </div>

      {/* Floating task card */}
      <div
        className="absolute -bottom-14 -left-2 hidden w-56 rounded-2xl border border-line bg-surface p-3 shadow-xl shadow-black/10 sm:block lg:-left-8"
        aria-hidden="true"
      >
        <p className="text-xs font-semibold">Today</p>
        <ul className="mt-2 space-y-2 text-xs">
          <li className="flex items-center gap-2 text-ink-muted line-through">
            <span className="grid size-4 place-items-center rounded-full bg-ink text-surface">
              <CheckIcon className="size-2.5" strokeWidth={3} />
            </span>
            Write reminder tests
          </li>
          <li className="flex items-center gap-2">
            <span className="size-4 rounded-full border-2 border-dusty-orange" />
            Review PR #4
            <span className="ml-auto text-[10px] text-ink-muted">2:30 pm</span>
          </li>
          <li className="flex items-center gap-2">
            <span className="size-4 rounded-full border-2 border-ink-muted/60" />
            Read chapter 7
          </li>
        </ul>
      </div>
    </div>
  )
}

// ---------- Small pieces ----------

function DotGrid() {
  return (
    <div
      className="pointer-events-none absolute inset-0 [mask-image:radial-gradient(ellipse_at_top,black_30%,transparent_75%)]"
      style={{
        backgroundImage: 'radial-gradient(color-mix(in srgb, var(--color-ink) 14%, transparent) 1px, transparent 1px)',
        backgroundSize: '22px 22px',
      }}
      aria-hidden="true"
    />
  )
}

function Feature({ icon, tint, title, children }: { icon: ReactNode; tint: string; title: string; children: ReactNode }) {
  return (
    <div className="group rounded-2xl border border-line bg-surface p-6 transition-colors hover:border-ink-muted/40">
      <div className={`grid size-11 place-items-center rounded-xl text-ink ${tint} [&>svg]:size-5`}>{icon}</div>
      <h3 className="mt-5 font-semibold">{title}</h3>
      <p className="mt-2 text-sm leading-relaxed text-ink-muted">{children}</p>
    </div>
  )
}

function Detail({ title, children }: { title: string; children: ReactNode }) {
  return (
    <li className="flex gap-3">
      <span className="mt-1 grid size-5 shrink-0 place-items-center rounded-full bg-dusty-orange/25 text-ink">
        <CheckIcon className="size-3" strokeWidth={3} />
      </span>
      <div>
        <p className="font-medium">{title}</p>
        <p className="mt-1 text-sm leading-relaxed text-ink-muted">{children}</p>
      </div>
    </li>
  )
}

/** A terminal-style card. Always dark, in both themes, like a real editor. */
function CodeWindow({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="overflow-hidden rounded-2xl border border-[#39363c] bg-[#1d1c20] text-[#ece8ea] shadow-xl shadow-black/10">
      <div className="flex items-center gap-3 border-b border-white/10 px-4 py-2.5">
        <div className="flex gap-1.5" aria-hidden="true">
          <span className="size-2.5 rounded-full bg-white/15" />
          <span className="size-2.5 rounded-full bg-white/15" />
          <span className="size-2.5 rounded-full bg-white/15" />
        </div>
        <span className="font-mono text-xs text-[#a7a2aa]">{title}</span>
      </div>
      <pre className="overflow-x-auto p-4 font-mono text-[12.5px] leading-6">{children}</pre>
    </div>
  )
}

function Line({ muted, children }: { muted?: boolean; children: ReactNode }) {
  return <div className={muted ? 'text-[#8a858d]' : ''}>{children}</div>
}

const Key = ({ children }: { children: ReactNode }) => <span className="text-[#acaec5]">{children}</span>
const Val = ({ children }: { children: ReactNode }) => <span className="text-[#efa18a]">{children}</span>

function Release({
  version,
  name,
  status,
  children,
}: {
  version: string
  name: string
  status: 'shipped' | 'next' | 'planned'
  children: ReactNode
}) {
  const badge = {
    shipped: 'bg-periwinkle/40 text-ink',
    next: 'bg-dusty-orange text-on-pastel',
    planned: 'border border-line text-ink-muted',
  }[status]
  return (
    <li className="relative rounded-2xl border border-line bg-surface p-5">
      <div className="flex items-center justify-between">
        <span className="font-mono text-sm font-semibold">{version}</span>
        <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium capitalize ${badge}`}>{status}</span>
      </div>
      <h3 className="mt-3 font-semibold">{name}</h3>
      <p className="mt-1.5 text-sm leading-relaxed text-ink-muted">{children}</p>
    </li>
  )
}
