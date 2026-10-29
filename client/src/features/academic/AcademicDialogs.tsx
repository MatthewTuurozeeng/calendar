import { addDays, addMonths } from 'date-fns'
import { useId, useState, type FormEvent, type ReactNode } from 'react'
import { Dialog } from '../../components/ui/Dialog'
import { errorClass, inputClass, labelClass, primaryButtonClass, secondaryButtonClass } from '../../components/ui/form'
import { CheckIcon } from '../../components/ui/icons'
import { toDateString } from '../../lib/dates'
import { useAuth } from '../auth/auth-context'
import { useUserData } from '../auth/user-data'
import { CATEGORY_COLORS } from '../categories/api'
import { ReminderPicker } from '../reminders/ReminderPicker'
import { notificationPrefs } from '../settings/prefs'
import type { TaskPriority } from '../tasks/api'
import {
  createAssessment,
  createAssignment,
  createClassTime,
  createCourse,
  createSemester,
  updateCourse,
  updateSemester,
  type Course,
  type Semester,
} from './api'
import { clashesWith, firstClassDate, weekdayList, type ClassSlot } from './timetable'

// The Academic Planner's forms (README §4.8).

/** Submit handling shared by every form: pending state, errors, close on success. */
function useSubmit(onClose: () => void) {
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  async function run(validate: () => string | null, save: () => Promise<unknown>) {
    const problem = validate()
    if (problem) return setError(problem)
    setError(null)
    setPending(true)
    try {
      await save()
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong. Try again.')
      setPending(false)
    }
  }
  return { pending, error, run }
}

function FormDialog({
  title,
  subtitle,
  submitLabel,
  pending,
  error,
  onSubmit,
  onClose,
  children,
}: {
  title: string
  subtitle?: string
  submitLabel: string
  pending: boolean
  error: string | null
  onSubmit: () => void
  onClose: () => void
  children: ReactNode
}) {
  const titleId = useId()
  return (
    <Dialog labelledBy={titleId} onClose={onClose}>
      <h2 id={titleId} className="pr-10 text-lg font-semibold">
        {title}
      </h2>
      {subtitle && <p className="mt-1 text-ink-muted">{subtitle}</p>}
      <form
        noValidate
        className="mt-5 flex flex-col gap-4"
        onSubmit={(e: FormEvent) => {
          e.preventDefault()
          onSubmit()
        }}
      >
        {children}
        {error && (
          <p role="alert" className={errorClass}>
            {error}
          </p>
        )}
        <div className="mt-2 flex justify-end gap-3">
          <button type="button" onClick={onClose} className={secondaryButtonClass}>
            Cancel
          </button>
          <button type="submit" disabled={pending} className={primaryButtonClass}>
            {pending ? 'Saving…' : submitLabel}
          </button>
        </div>
      </form>
    </Dialog>
  )
}

function Field({ id, label, hint, children }: { id: string; label: string; hint?: string; children: ReactNode }) {
  return (
    <div>
      <label htmlFor={id} className={labelClass}>
        {label}
      </label>
      {children}
      {hint && <p className="mt-1 text-xs text-ink-muted">{hint}</p>}
    </div>
  )
}

/** The Study category, if the user still has one, so academic items group with it. */
function useStudyCategory(): string | null {
  const { categories } = useUserData()
  return categories.find((c) => c.name.trim().toLowerCase() === 'study')?.id ?? null
}

function useOwner(course: Course) {
  const { session } = useAuth()
  const { profile } = useUserData()
  const categoryId = useStudyCategory()
  return { userId: session!.user.id, course, timeZone: profile.timezone, categoryId }
}

// ---------- Semester ----------

export function SemesterDialog({
  semester,
  onClose,
  onSaved,
}: {
  semester?: Semester
  onClose: () => void
  onSaved?: (semester: Semester) => void
}) {
  const { session } = useAuth()
  const today = new Date()
  const [name, setName] = useState(semester?.name ?? '')
  const [start, setStart] = useState(semester?.start_date ?? toDateString(today))
  const [end, setEnd] = useState(semester?.end_date ?? toDateString(addDays(addMonths(today, 4), -1)))
  const { pending, error, run } = useSubmit(onClose)

  return (
    <FormDialog
      title={semester ? 'Edit semester' : 'New semester'}
      submitLabel={semester ? 'Save' : 'Create semester'}
      pending={pending}
      error={error}
      onClose={onClose}
      onSubmit={() =>
        run(
          () =>
            !name.trim() ? 'Give the semester a name.' : !start || !end ? 'Choose both dates.' : end < start ? 'The end date must be after the start.' : null,
          async () => {
            const values = { name: name.trim(), start_date: start, end_date: end }
            if (semester) await updateSemester(semester.id, values)
            else onSaved?.(await createSemester({ ...values, user_id: session!.user.id }))
          },
        )
      }
    >
      <Field id="semester-name" label="Name">
        <input
          id="semester-name"
          className={inputClass}
          placeholder="e.g. Fall 2026"
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={100}
          autoFocus
        />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field id="semester-start" label="Starts">
          <input id="semester-start" type="date" className={inputClass} value={start} onChange={(e) => setStart(e.target.value)} />
        </Field>
        <Field id="semester-end" label="Ends">
          <input id="semester-end" type="date" className={inputClass} value={end} onChange={(e) => setEnd(e.target.value)} />
        </Field>
      </div>
      {semester && (
        <p className="text-sm text-ink-muted">Changing the dates doesn't move class times you've already added.</p>
      )}
    </FormDialog>
  )
}

// ---------- Course ----------

export function CourseDialog({
  semester,
  course,
  usedColors,
  onClose,
}: {
  semester: Semester
  course?: Course
  usedColors: string[]
  onClose: () => void
}) {
  const { session } = useAuth()
  const freeColor = CATEGORY_COLORS.find((c) => !usedColors.includes(c.hex))?.hex ?? CATEGORY_COLORS[0].hex
  const [code, setCode] = useState(course?.code ?? '')
  const [title, setTitle] = useState(course?.title ?? '')
  const [lecturer, setLecturer] = useState(course?.lecturer ?? '')
  const [venue, setVenue] = useState(course?.venue ?? '')
  const [color, setColor] = useState(course?.color ?? freeColor)
  const { pending, error, run } = useSubmit(onClose)

  return (
    <FormDialog
      title={course ? 'Edit course' : 'Add a course'}
      subtitle={semester.name}
      submitLabel={course ? 'Save' : 'Add course'}
      pending={pending}
      error={error}
      onClose={onClose}
      onSubmit={() =>
        run(
          () => (!code.trim() ? 'Enter a course code.' : !title.trim() ? 'Enter the course title.' : null),
          async () => {
            const values = {
              code: code.trim(),
              title: title.trim(),
              lecturer: lecturer.trim() || null,
              venue: venue.trim() || null,
              color,
            }
            if (course) await updateCourse(course.id, values)
            else await createCourse({ ...values, user_id: session!.user.id, semester_id: semester.id })
          },
        )
      }
    >
      <div className="grid grid-cols-[2fr_3fr] gap-3">
        <Field id="course-code" label="Code">
          <input
            id="course-code"
            className={inputClass}
            placeholder="CS 301"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            maxLength={20}
            autoFocus
          />
        </Field>
        <Field id="course-title" label="Title">
          <input
            id="course-title"
            className={inputClass}
            placeholder="Algorithms"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            maxLength={120}
          />
        </Field>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Field id="course-lecturer" label="Lecturer (optional)">
          <input id="course-lecturer" className={inputClass} value={lecturer} onChange={(e) => setLecturer(e.target.value)} />
        </Field>
        <Field id="course-venue" label="Venue (optional)">
          <input id="course-venue" className={inputClass} value={venue} onChange={(e) => setVenue(e.target.value)} />
        </Field>
      </div>
      <fieldset>
        <legend className={labelClass}>Color</legend>
        <div className="flex flex-wrap gap-2">
          {CATEGORY_COLORS.map((c) => (
            <button
              key={c.hex}
              type="button"
              aria-label={c.name}
              aria-pressed={color === c.hex}
              onClick={() => setColor(c.hex)}
              className="grid size-9 place-items-center rounded-full text-on-pastel ring-offset-2 ring-offset-surface aria-pressed:ring-2 aria-pressed:ring-ink"
              style={{ backgroundColor: c.hex }}
            >
              {color === c.hex && <CheckIcon className="size-4" strokeWidth={3} />}
            </button>
          ))}
        </div>
      </fieldset>
    </FormDialog>
  )
}

// ---------- Class time ----------

const TIMETABLE_DAYS = [1, 2, 3, 4, 5, 6, 0]
const DAY_INITIALS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa']
const CLASS_LABELS = ['Lecture', 'Tutorial', 'Lab', 'Seminar']

const toMinutes = (time: string) => {
  const [h, m] = time.split(':').map(Number)
  return h * 60 + m
}

export function ClassTimeDialog({
  semester,
  course,
  slots,
  onClose,
}: {
  semester: Semester
  course: Course
  /** The semester's existing class slots, for clash warnings. */
  slots: ClassSlot[]
  onClose: () => void
}) {
  const owner = useOwner(course)
  const { profile } = useUserData()
  const [label, setLabel] = useState('Lecture')
  const [weekdays, setWeekdays] = useState<number[]>([])
  const [startTime, setStartTime] = useState('09:00')
  const [endTime, setEndTime] = useState('10:30')
  const [location, setLocation] = useState(course.venue ?? '')
  const [reminders, setReminders] = useState<number[]>(notificationPrefs(profile).default_event_reminders)
  const { pending, error, run } = useSubmit(onClose)

  const timesValid = startTime && endTime && toMinutes(endTime) > toMinutes(startTime)
  const clashes =
    timesValid && weekdays.length > 0
      ? clashesWith({ weekdays, start: toMinutes(startTime), end: toMinutes(endTime) }, slots)
      : []

  const toggleDay = (day: number) =>
    setWeekdays((days) => (days.includes(day) ? days.filter((d) => d !== day) : [...days, day]))

  return (
    <FormDialog
      title="Add a class time"
      subtitle={`${course.code} · repeats weekly until ${semester.end_date}`}
      submitLabel="Add to timetable"
      pending={pending}
      error={error}
      onClose={onClose}
      onSubmit={() =>
        run(
          () =>
            weekdays.length === 0
              ? 'Choose at least one day.'
              : !timesValid
                ? 'The class must end after it starts.'
                : !firstClassDate(semester.start_date, semester.end_date, weekdays)
                  ? 'None of those days fall inside the semester.'
                  : null,
          () => createClassTime(owner, semester, { label, weekdays, startTime, endTime, location, reminderOffsets: reminders }),
        )
      }
    >
      <Field id="class-label" label="Type">
        <select id="class-label" className={inputClass} value={label} onChange={(e) => setLabel(e.target.value)}>
          {CLASS_LABELS.map((l) => (
            <option key={l}>{l}</option>
          ))}
        </select>
      </Field>
      <fieldset>
        <legend className={labelClass}>Days</legend>
        <div className="flex flex-wrap gap-1.5">
          {TIMETABLE_DAYS.map((day) => (
            <button
              key={day}
              type="button"
              aria-pressed={weekdays.includes(day)}
              onClick={() => toggleDay(day)}
              className="grid size-11 place-items-center rounded-full border border-line text-sm font-medium aria-pressed:border-transparent aria-pressed:bg-accent aria-pressed:text-on-pastel"
            >
              {DAY_INITIALS[day]}
            </button>
          ))}
        </div>
      </fieldset>
      <div className="grid grid-cols-2 gap-3">
        <Field id="class-start" label="Starts">
          <input id="class-start" type="time" className={inputClass} value={startTime} onChange={(e) => setStartTime(e.target.value)} />
        </Field>
        <Field id="class-end" label="Ends">
          <input id="class-end" type="time" className={inputClass} value={endTime} onChange={(e) => setEndTime(e.target.value)} />
        </Field>
      </div>
      <Field id="class-location" label="Room (optional)">
        <input id="class-location" className={inputClass} value={location} onChange={(e) => setLocation(e.target.value)} />
      </Field>
      <ReminderPicker value={reminders} onChange={setReminders} />
      {clashes.length > 0 && (
        <div role="status" className="rounded-xl bg-warm-peach/25 px-3 py-2 text-sm">
          <p className="font-medium">Clashes with your timetable</p>
          <ul className="mt-1 list-disc pl-5">
            {clashes.map((s) => (
              <li key={s.eventId}>
                {s.title} on {weekdayList(s.weekdays.filter((d) => weekdays.includes(d)))}
              </li>
            ))}
          </ul>
          <p className="mt-1 text-ink-muted">You can still add it.</p>
        </div>
      )}
    </FormDialog>
  )
}

// ---------- Quiz or exam ----------

export function AssessmentDialog({ course, onClose }: { course: Course; onClose: () => void }) {
  const owner = useOwner(course)
  const { profile } = useUserData()
  const [kind, setKind] = useState<'quiz' | 'exam'>('exam')
  const [title, setTitle] = useState('')
  const [date, setDate] = useState(toDateString(addDays(new Date(), 7)))
  const [startTime, setStartTime] = useState('09:00')
  const [endTime, setEndTime] = useState('11:00')
  const [location, setLocation] = useState(course.venue ?? '')
  const [reminders, setReminders] = useState<number[]>([1440, ...notificationPrefs(profile).default_event_reminders])
  const { pending, error, run } = useSubmit(onClose)

  return (
    <FormDialog
      title="Add a quiz or exam"
      subtitle={`${course.code} · ${course.title}`}
      submitLabel="Add to calendar"
      pending={pending}
      error={error}
      onClose={onClose}
      onSubmit={() =>
        run(
          () =>
            !date ? 'Choose a date.' : !startTime || !endTime || toMinutes(endTime) <= toMinutes(startTime) ? 'It must end after it starts.' : null,
          () =>
            createAssessment(owner, {
              kind,
              title: title.trim() || (kind === 'exam' ? 'Exam' : 'Quiz'),
              date,
              startTime,
              endTime,
              location,
              reminderOffsets: [...new Set(reminders)],
            }),
        )
      }
    >
      <div className="grid grid-cols-[auto_1fr] gap-3">
        <Field id="assessment-kind" label="Type">
          <select
            id="assessment-kind"
            className={inputClass}
            value={kind}
            onChange={(e) => setKind(e.target.value as 'quiz' | 'exam')}
          >
            <option value="exam">Exam</option>
            <option value="quiz">Quiz</option>
          </select>
        </Field>
        <Field id="assessment-title" label="Name">
          <input
            id="assessment-title"
            className={inputClass}
            placeholder={kind === 'exam' ? 'Midterm' : 'Quiz 2'}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            maxLength={120}
            autoFocus
          />
        </Field>
      </div>
      <Field id="assessment-date" label="Date">
        <input id="assessment-date" type="date" className={inputClass} value={date} onChange={(e) => setDate(e.target.value)} />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field id="assessment-start" label="Starts">
          <input id="assessment-start" type="time" className={inputClass} value={startTime} onChange={(e) => setStartTime(e.target.value)} />
        </Field>
        <Field id="assessment-end" label="Ends">
          <input id="assessment-end" type="time" className={inputClass} value={endTime} onChange={(e) => setEndTime(e.target.value)} />
        </Field>
      </div>
      <Field id="assessment-location" label="Room (optional)">
        <input id="assessment-location" className={inputClass} value={location} onChange={(e) => setLocation(e.target.value)} />
      </Field>
      <ReminderPicker value={reminders} onChange={setReminders} presets={[60, 1440, 10080]} />
    </FormDialog>
  )
}

// ---------- Assignment ----------

export function AssignmentDialog({ course, onClose }: { course: Course; onClose: () => void }) {
  const owner = useOwner(course)
  const [title, setTitle] = useState('')
  const [dueDate, setDueDate] = useState(toDateString(addDays(new Date(), 7)))
  const [dueTime, setDueTime] = useState('23:59')
  const [priority, setPriority] = useState<TaskPriority>('medium')
  const [reminders, setReminders] = useState<number[]>([1440])
  const { pending, error, run } = useSubmit(onClose)

  return (
    <FormDialog
      title="Add an assignment"
      subtitle={`${course.code} · added to your tasks`}
      submitLabel="Add assignment"
      pending={pending}
      error={error}
      onClose={onClose}
      onSubmit={() =>
        run(
          () => (!title.trim() ? 'Give the assignment a name.' : !dueDate ? 'Choose a due date.' : null),
          () => createAssignment(owner, { title, dueDate, dueTime, priority, reminderOffsets: reminders }),
        )
      }
    >
      <Field id="assignment-title" label="Name">
        <input
          id="assignment-title"
          className={inputClass}
          placeholder="Problem set 3"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          maxLength={180}
          autoFocus
        />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field id="assignment-date" label="Due">
          <input id="assignment-date" type="date" className={inputClass} value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
        </Field>
        <Field id="assignment-time" label="Time (optional)">
          <input id="assignment-time" type="time" className={inputClass} value={dueTime} onChange={(e) => setDueTime(e.target.value)} />
        </Field>
      </div>
      <Field id="assignment-priority" label="Priority">
        <select
          id="assignment-priority"
          className={inputClass}
          value={priority}
          onChange={(e) => setPriority(e.target.value as TaskPriority)}
        >
          <option value="low">Low</option>
          <option value="medium">Medium</option>
          <option value="high">High</option>
        </select>
      </Field>
      <ReminderPicker value={reminders} onChange={setReminders} presets={[60, 1440, 2880]} atStartLabel="When due" />
    </FormDialog>
  )
}
