import { addDays, format, startOfDay } from 'date-fns'
import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import { useSearchParams } from 'react-router'
import { primaryButtonClass, secondaryButtonClass } from '../../components/ui/form'
import { PlusIcon, XIcon } from '../../components/ui/icons'
import { parseLocal, toDateString } from '../../lib/dates'
import { useNow } from '../../lib/use-now'
import { useUserData } from '../auth/user-data'
import { deleteEvent, eventChanges, type EventRow } from '../events/api'
import { EventDialog } from '../events/EventDialog'
import { fetchOccurrences } from '../recurrence/api'
import type { Occurrence } from '../recurrence/expand'
import { calendarPrefs } from '../settings/prefs'
import type { Task } from '../tasks/api'
import { TaskDialog } from '../tasks/TaskDialog'
import { TaskItem } from '../tasks/TaskItem'
import { useTasks } from '../tasks/use-tasks'
import {
  academicChanges,
  deleteCourse,
  deleteSemester,
  fetchClassEvents,
  fetchCourses,
  fetchSemesters,
  updateSemester,
  type Course,
  type Semester,
} from './api'
import { AssessmentDialog, AssignmentDialog, ClassTimeDialog, CourseDialog, SemesterDialog } from './AcademicDialogs'
import {
  defaultSemester,
  findClashes,
  formatMinutesOfDay,
  semesterProgress,
  slotFromEvent,
  weekdayList,
  type ClassSlot,
} from './timetable'

// The Academic Planner (README §4.8): semesters, courses, a weekly timetable,
// and what's coming up. Everything it creates is an ordinary event or task.

type SemesterData = { courses: Course[]; classes: EventRow[]; assessments: Occurrence[] }

type DialogState =
  | { kind: 'semester'; semester?: Semester }
  | { kind: 'course'; course?: Course }
  | { kind: 'class' | 'assessment' | 'assignment'; course: Course }
  | { kind: 'event'; occurrence: Occurrence }
  | { kind: 'task'; task: Task }

const TIMETABLE_DAYS = [1, 2, 3, 4, 5, 6, 0]
const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

export function AcademicPage() {
  const { profile, updateProfile } = useUserData()
  if (!profile.enabled_modules.includes('academic')) {
    return (
      <div className="rounded-2xl border border-dashed border-line bg-surface px-6 py-12 text-center">
        <h2 className="text-lg font-semibold">The Academic planner is off</h2>
        <p className="mx-auto mt-2 max-w-sm text-sm text-ink-muted">
          Turn it on to plan semesters, courses, class times, quizzes, exams and assignments. Turning it off later
          keeps everything.
        </p>
        <button
          type="button"
          className={`${primaryButtonClass} mt-6`}
          onClick={() => void updateProfile({ enabled_modules: [...profile.enabled_modules, 'academic'] })}
        >
          Turn on Academic planner
        </button>
      </div>
    )
  }
  return <Planner />
}

function Planner() {
  const { profile } = useUserData()
  const now = useNow()
  const today = toDateString(now)
  const use24h = calendarPrefs(profile).time_format === '24h'
  const [searchParams, setSearchParams] = useSearchParams()
  const [semesters, setSemesters] = useState<Semester[] | null>(null)
  const [data, setData] = useState<SemesterData | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [dialog, setDialog] = useState<DialogState | null>(null)
  const [attempt, setAttempt] = useState(0)
  const reload = useCallback(() => setAttempt((n) => n + 1), [])
  const { state: tasksState } = useTasks()

  useEffect(() => {
    academicChanges.addEventListener('change', reload)
    eventChanges.addEventListener('change', reload)
    return () => {
      academicChanges.removeEventListener('change', reload)
      eventChanges.removeEventListener('change', reload)
    }
  }, [reload])

  useEffect(() => {
    let cancelled = false
    fetchSemesters().then(
      (rows) => !cancelled && setSemesters(rows),
      (err: unknown) => !cancelled && setError(err instanceof Error ? err.message : 'Could not load semesters.'),
    )
    return () => {
      cancelled = true
    }
  }, [attempt])

  const selected =
    semesters?.find((s) => s.id === searchParams.get('semester')) ?? (semesters ? defaultSemester(semesters, today) : undefined)
  const selectedId = selected?.id
  const selectedEnd = selected?.end_date

  useEffect(() => {
    if (!selectedId || !selectedEnd) return
    let cancelled = false
    ;(async () => {
      const courses = await fetchCourses(selectedId)
      const ids = courses.map((c) => c.id)
      const from = startOfDay(new Date())
      const until = addDays(parseLocal(selectedEnd), 1)
      const [classes, occurrences] = await Promise.all([
        fetchClassEvents(ids),
        until > from ? fetchOccurrences(from, until) : Promise.resolve([]),
      ])
      const assessments = occurrences.filter(
        (o) => o.event.course_id && ids.includes(o.event.course_id) && (o.event.kind === 'quiz' || o.event.kind === 'exam'),
      )
      if (!cancelled) setData({ courses, classes, assessments })
    })().catch((err: unknown) => !cancelled && setError(err instanceof Error ? err.message : 'Could not load the semester.'))
    return () => {
      cancelled = true
    }
  }, [selectedId, selectedEnd, attempt])

  const slots = useMemo(
    () => (data?.classes ?? []).map(slotFromEvent).filter((s): s is ClassSlot => s !== null),
    [data],
  )
  const clashes = useMemo(() => findClashes(slots), [slots])

  if (error) {
    return (
      <div role="alert" className="rounded-2xl border border-line bg-surface p-6">
        <p className="font-medium">Couldn't load the Academic planner</p>
        <p className="mt-1 text-sm text-ink-muted">{error}</p>
        <button
          type="button"
          className={`${secondaryButtonClass} mt-4`}
          onClick={() => {
            setError(null)
            reload()
          }}
        >
          Try again
        </button>
      </div>
    )
  }
  if (!semesters) return <p className="text-ink-muted">Loading…</p>

  const dialogs = (
    <>
      {dialog?.kind === 'semester' && (
        <SemesterDialog
          semester={dialog.semester}
          onClose={() => setDialog(null)}
          onSaved={(s) => setSearchParams({ semester: s.id })}
        />
      )}
      {dialog?.kind === 'course' && selected && (
        <CourseDialog
          semester={selected}
          course={dialog.course}
          usedColors={(data?.courses ?? []).map((c) => c.color ?? '')}
          onClose={() => setDialog(null)}
        />
      )}
      {dialog?.kind === 'class' && selected && (
        <ClassTimeDialog semester={selected} course={dialog.course} slots={slots} onClose={() => setDialog(null)} />
      )}
      {dialog?.kind === 'assessment' && <AssessmentDialog course={dialog.course} onClose={() => setDialog(null)} />}
      {dialog?.kind === 'assignment' && <AssignmentDialog course={dialog.course} onClose={() => setDialog(null)} />}
      {dialog?.kind === 'event' && <EventDialog occurrence={dialog.occurrence} onClose={() => setDialog(null)} />}
      {dialog?.kind === 'task' && <TaskDialog task={dialog.task} onClose={() => setDialog(null)} />}
    </>
  )

  if (!selected) {
    return (
      <div className="max-w-2xl">
        <div className="rounded-2xl border border-line bg-surface p-6 sm:p-8">
          <p className="font-mono text-xs tracking-wider text-dusty-orange uppercase">Academic planner</p>
          <h2 className="mt-2 text-2xl font-semibold tracking-tight">Set up your semester</h2>
          <ol className="mt-6 space-y-4">
            {[
              ['Create a semester', 'Its start and end dates bound every class series.'],
              ['Add your courses', 'A code, title and color, with an optional lecturer and venue.'],
              ['Add class times', 'Pick the days and times once; each becomes a weekly series on your calendar.'],
              ['Track quizzes, exams and assignments', 'Assignments are tasks, so you can schedule time to work on them.'],
            ].map(([title, text], i) => (
              <li key={title} className="flex gap-4">
                <span className="grid size-7 shrink-0 place-items-center rounded-full bg-warm-peach/40 text-sm font-semibold">
                  {i + 1}
                </span>
                <div>
                  <p className="font-medium">{title}</p>
                  <p className="text-sm text-ink-muted">{text}</p>
                </div>
              </li>
            ))}
          </ol>
          <button type="button" className={`${primaryButtonClass} mt-8 gap-2`} onClick={() => setDialog({ kind: 'semester' })}>
            <PlusIcon className="size-5" /> Create a semester
          </button>
        </div>
        {dialogs}
      </div>
    )
  }

  const courseById = new Map((data?.courses ?? []).map((c) => [c.id, c]))
  const archived = !!selected.archived_at
  const tasks = tasksState.status === 'ready' ? tasksState.tasks : []
  const assignments = tasks
    .filter((t) => t.course_id && courseById.has(t.course_id) && t.status !== 'completed')
    .sort((a, b) => dueKey(a).localeCompare(dueKey(b)))
  const timeRange = (s: ClassSlot) => `${formatMinutesOfDay(s.start, use24h)}–${formatMinutesOfDay(s.end, use24h)}`

  return (
    <div className="flex max-w-5xl flex-col gap-6">
      {/* ---------- Semester bar ---------- */}
      <div className="flex flex-wrap items-center gap-3">
        <label htmlFor="semester-picker" className="sr-only">
          Semester
        </label>
        <select
          id="semester-picker"
          className="min-h-11 rounded-xl border border-line bg-surface px-3 text-lg font-semibold"
          value={selected.id}
          onChange={(e) => setSearchParams({ semester: e.target.value })}
        >
          {semesters.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
              {s.archived_at ? ' (archived)' : ''}
            </option>
          ))}
        </select>
        <span className="rounded-full bg-periwinkle/35 px-3 py-1 text-sm font-medium">
          {archived ? 'Archived' : semesterProgress(selected, today)}
        </span>
        <span className="text-sm text-ink-muted">
          {format(parseLocal(selected.start_date), 'd MMM')} – {format(parseLocal(selected.end_date), 'd MMM yyyy')}
        </span>
        <div className="ml-auto flex flex-wrap gap-2">
          <button type="button" className={`${secondaryButtonClass} min-h-10 text-sm`} onClick={() => setDialog({ kind: 'semester', semester: selected })}>
            Edit
          </button>
          <button
            type="button"
            className={`${secondaryButtonClass} min-h-10 text-sm`}
            onClick={() => void updateSemester(selected.id, { archived_at: archived ? null : new Date().toISOString() })}
          >
            {archived ? 'Unarchive' : 'Archive'}
          </button>
          <ConfirmButton
            label="Delete"
            confirmLabel="Delete semester and everything in it?"
            onConfirm={async () => {
              await deleteSemester(selected.id)
              setSearchParams({})
            }}
          />
          <button type="button" className={`${primaryButtonClass} min-h-10 gap-1.5 text-sm`} onClick={() => setDialog({ kind: 'semester' })}>
            <PlusIcon className="size-4" /> New semester
          </button>
        </div>
      </div>

      {clashes.length > 0 && (
        <div role="status" className="rounded-2xl border border-dusty-orange/40 bg-warm-peach/20 px-5 py-4">
          <p className="font-medium">
            {clashes.length === 1 ? '1 timetable clash' : `${clashes.length} timetable clashes`}
          </p>
          <ul className="mt-1 text-sm text-ink-muted">
            {clashes.map((c) => (
              <li key={`${c.a.eventId}:${c.b.eventId}`}>
                {c.a.title} and {c.b.title} overlap on {weekdayList(c.weekdays)}
              </li>
            ))}
          </ul>
        </div>
      )}

      {!data ? (
        <p className="text-ink-muted">Loading…</p>
      ) : (
        <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
          {/* ---------- Courses ---------- */}
          <section aria-labelledby="courses-heading" className="flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <h2 id="courses-heading" className="text-base font-semibold">
                Courses
              </h2>
              {!archived && (
                <button
                  type="button"
                  className="inline-flex min-h-10 items-center gap-1.5 rounded-xl px-3 text-sm font-medium text-ink-muted hover:bg-surface hover:text-ink"
                  onClick={() => setDialog({ kind: 'course' })}
                >
                  <PlusIcon className="size-4" /> Add course
                </button>
              )}
            </div>
            {data.courses.length === 0 && (
              <button
                type="button"
                onClick={() => setDialog({ kind: 'course' })}
                className="rounded-2xl border border-dashed border-line bg-surface px-6 py-10 text-center hover:border-ink-muted/50"
              >
                <p className="font-medium">Add your first course</p>
                <p className="mt-1 text-sm text-ink-muted">Then add its class times, quizzes, exams and assignments.</p>
              </button>
            )}
            {data.courses.map((course) => {
              const courseSlots = slots.filter((s) => s.courseId === course.id)
              return (
                <article key={course.id} className="overflow-hidden rounded-2xl border border-line bg-surface">
                  <div className="h-1.5" style={{ backgroundColor: course.color ?? '#E7E2E0' }} aria-hidden="true" />
                  <div className="p-5">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <h3 className="font-semibold">
                          <span className="font-mono text-sm">{course.code}</span> · {course.title}
                        </h3>
                        {(course.lecturer || course.venue) && (
                          <p className="mt-0.5 text-sm text-ink-muted">
                            {[course.lecturer, course.venue].filter(Boolean).join(' · ')}
                          </p>
                        )}
                      </div>
                      <div className="flex shrink-0 gap-1">
                        <button
                          type="button"
                          className="min-h-9 rounded-lg px-2 text-sm text-ink-muted hover:bg-canvas hover:text-ink"
                          onClick={() => setDialog({ kind: 'course', course })}
                        >
                          Edit
                        </button>
                        <ConfirmButton
                          label="Delete"
                          confirmLabel="Delete course, its classes and assignments?"
                          compact
                          onConfirm={() => deleteCourse(course.id)}
                        />
                      </div>
                    </div>

                    <ul className="mt-3 flex flex-col gap-1.5">
                      {courseSlots.length === 0 && <li className="text-sm text-ink-muted">No class times yet.</li>}
                      {courseSlots.map((s) => (
                        <li key={s.eventId} className="flex items-center gap-2 rounded-lg bg-canvas px-3 py-2 text-sm">
                          <span className="font-medium">{s.title.replace(course.code, '').trim() || 'Class'}</span>
                          <span className="text-ink-muted">
                            {weekdayList(s.weekdays)} · {timeRange(s)}
                            {s.location && ` · ${s.location}`}
                          </span>
                          <RemoveButton label={`Remove ${s.title}`} onConfirm={() => deleteEvent(s.eventId)} />
                        </li>
                      ))}
                    </ul>

                    {!archived && (
                      <div className="mt-4 flex flex-wrap gap-2">
                        <SmallAction onClick={() => setDialog({ kind: 'class', course })}>Class time</SmallAction>
                        <SmallAction onClick={() => setDialog({ kind: 'assessment', course })}>Quiz or exam</SmallAction>
                        <SmallAction onClick={() => setDialog({ kind: 'assignment', course })}>Assignment</SmallAction>
                      </div>
                    )}
                  </div>
                </article>
              )
            })}
          </section>

          <div className="flex flex-col gap-6">
            {/* ---------- Coming up ---------- */}
            <section aria-labelledby="upcoming-heading" className="rounded-2xl border border-line bg-surface">
              <h2 id="upcoming-heading" className="border-b border-line px-5 py-4 text-base font-semibold">
                Coming up
              </h2>
              {data.assessments.length === 0 && assignments.length === 0 ? (
                <p className="px-5 py-8 text-center text-sm text-ink-muted">No quizzes, exams or assignments ahead.</p>
              ) : (
                <>
                  {data.assessments.length > 0 && (
                    <ul className="divide-y divide-line">
                      {data.assessments.map((o) => {
                        const course = courseById.get(o.event.course_id!)
                        return (
                          <li key={o.key}>
                            <button
                              type="button"
                              onClick={() => setDialog({ kind: 'event', occurrence: o })}
                              className="flex min-h-14 w-full items-center gap-3 px-5 py-3 text-left hover:bg-canvas"
                            >
                              <span
                                className="h-8 w-1 shrink-0 rounded-full"
                                style={{ backgroundColor: course?.color ?? '#E7E2E0' }}
                                aria-hidden="true"
                              />
                              <span className="min-w-0 flex-1">
                                <span className="block truncate font-medium">{o.title}</span>
                                <span className="block text-sm text-ink-muted">
                                  {format(o.timing.start, use24h ? 'EEE d MMM, HH:mm' : 'EEE d MMM, h:mm a')}
                                  {o.location && ` · ${o.location}`}
                                </span>
                              </span>
                              <span
                                className={`rounded-full px-2 py-0.5 text-xs font-medium capitalize ${
                                  o.event.kind === 'exam' ? 'bg-dusty-orange text-on-pastel' : 'bg-periwinkle/40'
                                }`}
                              >
                                {o.event.kind}
                              </span>
                            </button>
                          </li>
                        )
                      })}
                    </ul>
                  )}
                  {assignments.length > 0 && (
                    <>
                      <h3 className="border-y border-line bg-canvas/60 px-5 py-2 text-xs font-semibold tracking-wide text-ink-muted uppercase">
                        Assignments
                      </h3>
                      <ul className="divide-y divide-line">
                        {assignments.map((t) => (
                          <li key={`${t.id}:${t.status}`}>
                            <TaskItem task={t} now={now} onOpen={(task) => setDialog({ kind: 'task', task })} onError={setError} />
                          </li>
                        ))}
                      </ul>
                    </>
                  )}
                </>
              )}
            </section>

            {/* ---------- Weekly timetable ---------- */}
            <section aria-labelledby="timetable-heading" className="rounded-2xl border border-line bg-surface">
              <h2 id="timetable-heading" className="border-b border-line px-5 py-4 text-base font-semibold">
                Weekly timetable
              </h2>
              {slots.length === 0 ? (
                <p className="px-5 py-8 text-center text-sm text-ink-muted">Class times you add show up here.</p>
              ) : (
                <dl className="divide-y divide-line">
                  {TIMETABLE_DAYS.filter((d) => slots.some((s) => s.weekdays.includes(d))).map((day) => (
                    <div key={day} className="px-5 py-3">
                      <dt className="text-xs font-semibold tracking-wide text-ink-muted uppercase">{DAY_NAMES[day]}</dt>
                      {slots
                        .filter((s) => s.weekdays.includes(day))
                        .sort((a, b) => a.start - b.start)
                        .map((s) => (
                          <dd key={s.eventId} className="mt-1.5 flex items-center gap-3 text-sm">
                            <span className="w-28 shrink-0 tabular-nums text-ink-muted">{timeRange(s)}</span>
                            <span
                              className="size-2.5 shrink-0 rounded-full"
                              style={{ backgroundColor: courseById.get(s.courseId)?.color ?? '#E7E2E0' }}
                              aria-hidden="true"
                            />
                            <span className="truncate font-medium">{s.title}</span>
                          </dd>
                        ))}
                    </div>
                  ))}
                </dl>
              )}
            </section>
          </div>
        </div>
      )}
      {dialogs}
    </div>
  )
}

/** Sorts undated tasks last. */
function dueKey(t: Task): string {
  return t.due_at ?? (t.due_date ? `${t.due_date}T23:59` : '9999')
}

function SmallAction({ onClick, children }: { onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex min-h-9 items-center gap-1 rounded-lg border border-line px-3 text-sm font-medium hover:bg-canvas"
    >
      <PlusIcon className="size-4" />
      {children}
    </button>
  )
}

/** A destructive button that asks once more before acting. */
function ConfirmButton({
  label,
  confirmLabel,
  compact,
  onConfirm,
}: {
  label: string
  confirmLabel: string
  compact?: boolean
  onConfirm: () => Promise<unknown>
}) {
  const [asking, setAsking] = useState(false)
  const [pending, setPending] = useState(false)
  const base = compact ? 'min-h-9 rounded-lg px-2 text-sm' : `${secondaryButtonClass} min-h-10 text-sm`
  if (!asking) {
    return (
      <button type="button" className={`${base} text-danger hover:bg-canvas`} onClick={() => setAsking(true)}>
        {label}
      </button>
    )
  }
  return (
    <span className="inline-flex items-center gap-1">
      <button
        type="button"
        disabled={pending}
        className={`${base} bg-danger/10 font-medium text-danger`}
        onClick={async () => {
          setPending(true)
          try {
            await onConfirm()
          } finally {
            setPending(false)
            setAsking(false)
          }
        }}
      >
        {pending ? 'Deleting…' : confirmLabel}
      </button>
      <button type="button" className={`${base} text-ink-muted`} onClick={() => setAsking(false)}>
        Cancel
      </button>
    </span>
  )
}

function RemoveButton({ label, onConfirm }: { label: string; onConfirm: () => Promise<unknown> }) {
  const [asking, setAsking] = useState(false)
  return asking ? (
    <span className="ml-auto inline-flex gap-2">
      <button type="button" className="font-medium text-danger" onClick={() => void onConfirm()}>
        Remove
      </button>
      <button type="button" className="text-ink-muted" onClick={() => setAsking(false)}>
        Keep
      </button>
    </span>
  ) : (
    <button
      type="button"
      aria-label={label}
      className="-mr-1 ml-auto grid size-8 shrink-0 place-items-center rounded-md text-ink-muted hover:bg-surface hover:text-ink"
      onClick={() => setAsking(true)}
    >
      <XIcon className="size-4" />
    </button>
  )
}
