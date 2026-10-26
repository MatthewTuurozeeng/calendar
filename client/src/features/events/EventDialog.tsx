import { addDays, addMinutes, differenceInMinutes, isValid } from 'date-fns'
import { useEffect, useId, useMemo, useState, type FormEvent } from 'react'
import { Dialog } from '../../components/ui/Dialog'
import {
  errorClass,
  inputClass,
  labelClass,
  primaryButtonClass,
  secondaryButtonClass,
} from '../../components/ui/form'
import { parseLocal, toDateString, toTimeString } from '../../lib/dates'
import { validateEvent, type FieldErrors } from '../../lib/validation'
import { useSession } from '../auth/auth-context'
import { useUserData } from '../auth/user-data'
import { deleteOccurrence, fetchOccurrences, saveOccurrence, scheduleColumns } from '../recurrence/api'
import { dateToFloating, toFloating, type Occurrence } from '../recurrence/expand'
import { RepeatField } from '../recurrence/RepeatField'
import { parseRule, type RepeatConfig } from '../recurrence/rule'
import { ScopeChooser } from '../recurrence/ScopeChooser'
import type { EditScope } from '../recurrence/scopes'
import { notificationPrefs } from '../settings/prefs'
import { setTaskStatus } from '../tasks/api'
import { createEvent } from './api'
import { defaultTiming, type EventTiming } from './timing'

type EventDialogProps = {
  /** The event, or occurrence of a series, to edit. Omit to create one at `timing`. */
  occurrence?: Occurrence
  timing?: EventTiming
  onClose: () => void
}

type FormState = {
  title: string
  description: string
  location: string
  categoryId: string
  allDay: boolean
  startDate: string
  startTime: string
  endDate: string
  endTime: string
  repeat: RepeatConfig | null
}

type Step = { kind: 'form' } | { kind: 'scope'; action: 'save' | 'delete' } | { kind: 'done'; removed: number }

function initialForm(occurrence: Occurrence | undefined, timing: EventTiming): FormState {
  // The form shows the last day of an all-day event; storage keeps an exclusive end.
  const shownEnd = timing.allDay ? addDays(timing.end, -1) : timing.end
  return {
    title: occurrence?.title ?? '',
    description: occurrence?.description ?? '',
    location: occurrence?.location ?? '',
    categoryId: occurrence?.category_id ?? '',
    allDay: timing.allDay,
    startDate: toDateString(timing.start),
    startTime: timing.allDay ? '09:00' : toTimeString(timing.start),
    endDate: toDateString(shownEnd),
    endTime: timing.allDay ? '10:00' : toTimeString(timing.end),
    repeat: occurrence?.event.rrule ? parseRule(occurrence.event.rrule) : null,
  }
}

function formTiming(form: FormState): EventTiming {
  return form.allDay
    ? { allDay: true, start: parseLocal(form.startDate), end: addDays(parseLocal(form.endDate), 1) }
    : {
        allDay: false,
        start: parseLocal(form.startDate, form.startTime),
        end: parseLocal(form.endDate, form.endTime),
      }
}

/** The start as a floating date in the event's zone, which repeat rules are anchored to. */
function floatingStart(form: FormState, timeZone: string): Date {
  const timing = formTiming(form)
  if (!isValid(timing.start)) return dateToFloating(toDateString(new Date()))
  return form.allDay ? dateToFloating(form.startDate) : toFloating(timing.start, timeZone)
}

export function EventDialog({ occurrence, timing, onClose }: EventDialogProps) {
  const session = useSession()
  const { profile, categories } = useUserData()
  const titleId = useId()
  const timeZone = occurrence?.event.timezone ?? profile.timezone
  const [initial] = useState(() => initialForm(occurrence, occurrence?.timing ?? timing ?? defaultTiming()))
  const [form, setForm] = useState(initial)
  const [errors, setErrors] = useState<FieldErrors<'title' | 'start' | 'end' | 'repeat'>>({})
  const [saveError, setSaveError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)
  const [confirmingDelete, setConfirmingDelete] = useState(false)
  const [step, setStep] = useState<Step>({ kind: 'form' })
  const [overlaps, setOverlaps] = useState<string[]>([])
  const [taskDone, setTaskDone] = useState(occurrence?.task?.status === 'completed')

  const isRecurring = !!occurrence?.original
  const repeatChanged = JSON.stringify(form.repeat) !== JSON.stringify(initial.repeat)
  const current = useMemo(() => formTiming(form), [form])
  const repeatStart = floatingStart(form, timeZone)
  const startMs = current.start.getTime()
  const endMs = current.end.getTime()

  // Overlaps are a warning only (README §4.1); they never block saving.
  useEffect(() => {
    if (current.allDay || !(endMs > startMs)) return
    let cancelled = false
    fetchOccurrences(new Date(startMs), new Date(endMs))
      .then((found) => {
        if (cancelled) return
        setOverlaps(found.filter((o) => !o.timing.allDay && o.key !== occurrence?.key).map((o) => o.title))
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [current.allDay, startMs, endMs, occurrence?.key])

  const visibleOverlaps = current.allDay || !(endMs > startMs) ? [] : overlaps

  // Saves straight away, like ticking the task off anywhere else.
  async function toggleTask(done: boolean) {
    if (!occurrence?.task) return
    setTaskDone(done)
    try {
      await setTaskStatus(occurrence.task.id, done ? 'completed' : 'pending')
    } catch (err) {
      setTaskDone(!done)
      setSaveError(err instanceof Error ? err.message : 'Could not update the task.')
    }
  }

  function update(patch: Partial<FormState>) {
    setForm((prev) => ({ ...prev, ...patch }))
  }

  // Moving the start keeps the event's length, like most calendars. A weekly
  // repeat on the start's weekday follows it to the new day.
  function updateStart(patch: Pick<Partial<FormState>, 'startDate' | 'startTime'>) {
    setForm((prev) => {
      let next = { ...prev, ...patch }
      const before = formTiming(prev)
      const after = formTiming(next)
      if (!isValid(before.start) || !isValid(before.end) || !isValid(after.start)) return next

      const newEnd = addMinutes(after.start, differenceInMinutes(before.end, before.start))
      const shownEnd = next.allDay ? addDays(newEnd, -1) : newEnd
      next = { ...next, endDate: toDateString(shownEnd), endTime: next.allDay ? next.endTime : toTimeString(newEnd) }

      const oldDay = floatingStart(prev, timeZone).getUTCDay()
      const newDay = floatingStart(next, timeZone).getUTCDay()
      if (next.repeat?.freq === 'weekly' && next.repeat.weekdays.length === 1 && next.repeat.weekdays[0] === oldDay) {
        next = { ...next, repeat: { ...next.repeat, weekdays: [newDay] } }
      }
      return next
    })
  }

  function values() {
    return {
      title: form.title.trim(),
      description: form.description.trim() || null,
      location: form.location.trim() || null,
      category_id: form.categoryId || null,
      timing: current,
    }
  }

  async function run(action: () => Promise<number | void>) {
    setPending(true)
    setSaveError(null)
    try {
      const removed = await action()
      if (removed) setStep({ kind: 'done', removed })
      else onClose()
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Something went wrong.')
      setStep({ kind: 'form' })
      setPending(false)
    }
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault()
    const found: FieldErrors<'title' | 'start' | 'end' | 'repeat'> = validateEvent({
      title: form.title,
      start: current.start,
      end: current.end,
    })
    if (form.repeat?.end.kind === 'until' && form.repeat.end.date < form.startDate) {
      found.repeat = 'The repeat must end on or after the first day.'
    }
    setErrors(found)
    if (Object.keys(found).length > 0) return

    if (!occurrence) {
      const { timing: t, ...content } = values()
      void run(() =>
        createEvent({
          ...content,
          ...scheduleColumns(t, form.repeat, profile.timezone),
          user_id: session.user.id,
          timezone: profile.timezone,
          reminder_offsets: notificationPrefs(profile).default_event_reminders,
        }).then(() => undefined),
      )
    } else if (isRecurring) {
      setStep({ kind: 'scope', action: 'save' })
    } else {
      void save('all')
    }
  }

  function save(scope: EditScope) {
    if (!occurrence) return
    return run(async () => (await saveOccurrence(occurrence, scope, values(), form.repeat)).removedExceptions)
  }

  function remove(scope: EditScope) {
    if (!occurrence) return
    return run(() => deleteOccurrence(occurrence, scope))
  }

  if (step.kind === 'done') {
    return (
      <Dialog labelledBy={titleId} onClose={onClose}>
        <h2 id={titleId} className="text-lg font-semibold">
          Saved
        </h2>
        <p className="mt-3">
          {step.removed === 1
            ? '1 edited or cancelled occurrence no longer fit the new schedule, so it was removed.'
            : `${step.removed} edited or cancelled occurrences no longer fit the new schedule, so they were removed.`}
        </p>
        <div className="mt-6 flex justify-end">
          <button type="button" onClick={onClose} className={primaryButtonClass} autoFocus>
            OK
          </button>
        </div>
      </Dialog>
    )
  }

  return (
    <Dialog labelledBy={titleId} onClose={onClose}>
      <h2 id={titleId} className="text-lg font-semibold">
        {occurrence ? 'Edit event' : 'New event'}
      </h2>

      {step.kind === 'scope' ? (
        <div className="mt-5">
          {saveError && (
            <p role="alert" className={`${errorClass} mb-3`}>
              {saveError}
            </p>
          )}
          <ScopeChooser
            action={step.action}
            allowThis={step.action === 'delete' || !repeatChanged}
            pending={pending}
            onCancel={() => setStep({ kind: 'form' })}
            onChoose={(scope) => void (step.action === 'save' ? save(scope) : remove(scope))}
          />
        </div>
      ) : (
        <form onSubmit={handleSubmit} noValidate className="mt-5 flex flex-col gap-4">
          <div>
            <label htmlFor="event-title" className={labelClass}>
              Title
            </label>
            <input
              id="event-title"
              className={inputClass}
              value={form.title}
              onChange={(e) => update({ title: e.target.value })}
              aria-invalid={!!errors.title}
              aria-describedby={errors.title ? 'event-title-error' : undefined}
              autoFocus
            />
            {errors.title && (
              <p id="event-title-error" className={errorClass}>
                {errors.title}
              </p>
            )}
          </div>

          {occurrence?.task && (
            <label className="flex min-h-11 items-center gap-3 rounded-xl bg-canvas px-3 py-2">
              <input
                type="checkbox"
                className="size-5 accent-ink"
                checked={taskDone}
                onChange={(e) => void toggleTask(e.target.checked)}
              />
              <span>
                <span className="block font-medium">Task done</span>
                <span className="block text-sm text-ink-muted">
                  This is time blocked for a task. Deleting the block keeps the task.
                </span>
              </span>
            </label>
          )}

          <label className="flex min-h-11 items-center gap-3">
            <input
              type="checkbox"
              className="size-5 accent-ink"
              checked={form.allDay}
              onChange={(e) => update({ allDay: e.target.checked })}
            />
            <span className="font-medium">All day</span>
          </label>

          <fieldset className="grid grid-cols-[1fr_auto] gap-x-3 gap-y-3">
            <legend className="sr-only">When</legend>
            <div>
              <label htmlFor="event-start-date" className={labelClass}>
                Starts
              </label>
              <input
                id="event-start-date"
                type="date"
                className={inputClass}
                value={form.startDate}
                onChange={(e) => updateStart({ startDate: e.target.value })}
                aria-invalid={!!errors.start}
              />
            </div>
            {!form.allDay ? (
              <div className="self-end">
                <label htmlFor="event-start-time" className="sr-only">
                  Start time
                </label>
                <input
                  id="event-start-time"
                  type="time"
                  className={inputClass}
                  value={form.startTime}
                  onChange={(e) => updateStart({ startTime: e.target.value })}
                  aria-invalid={!!errors.start}
                />
              </div>
            ) : (
              <span />
            )}
            <div>
              <label htmlFor="event-end-date" className={labelClass}>
                Ends
              </label>
              <input
                id="event-end-date"
                type="date"
                className={inputClass}
                value={form.endDate}
                onChange={(e) => update({ endDate: e.target.value })}
                aria-invalid={!!errors.end}
                aria-describedby={errors.end ? 'event-end-error' : undefined}
              />
            </div>
            {!form.allDay ? (
              <div className="self-end">
                <label htmlFor="event-end-time" className="sr-only">
                  End time
                </label>
                <input
                  id="event-end-time"
                  type="time"
                  className={inputClass}
                  value={form.endTime}
                  onChange={(e) => update({ endTime: e.target.value })}
                  aria-invalid={!!errors.end}
                />
              </div>
            ) : (
              <span />
            )}
            {(errors.start || errors.end) && (
              <p id="event-end-error" className={`${errorClass} col-span-2 mt-0`}>
                {errors.start ?? errors.end}
              </p>
            )}
          </fieldset>

          {visibleOverlaps.length > 0 && (
            <p role="status" className="rounded-xl bg-warm-peach/25 px-3 py-2 text-sm">
              <span className="font-medium">Overlaps with </span>
              {visibleOverlaps.join(', ')}
            </p>
          )}

          <RepeatField
            value={form.repeat}
            onChange={(repeat) => update({ repeat })}
            start={repeatStart}
            error={errors.repeat}
          />

          <div>
            <label htmlFor="event-category" className={labelClass}>
              Category
            </label>
            <select
              id="event-category"
              className={inputClass}
              value={form.categoryId}
              onChange={(e) => update({ categoryId: e.target.value })}
            >
              <option value="">None</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="event-location" className={labelClass}>
              Location <span className="font-normal text-ink-muted">(optional)</span>
            </label>
            <input
              id="event-location"
              className={inputClass}
              value={form.location}
              onChange={(e) => update({ location: e.target.value })}
              placeholder="Place or meeting link"
            />
          </div>

          <div>
            <label htmlFor="event-description" className={labelClass}>
              Notes <span className="font-normal text-ink-muted">(optional)</span>
            </label>
            <textarea
              id="event-description"
              rows={3}
              className={`${inputClass} py-2`}
              value={form.description}
              onChange={(e) => update({ description: e.target.value })}
            />
          </div>

          {saveError && (
            <p role="alert" className={errorClass}>
              {saveError}
            </p>
          )}

          <div className="mt-2 flex flex-wrap items-center gap-3">
            {occurrence &&
              (isRecurring ? (
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => setStep({ kind: 'scope', action: 'delete' })}
                  className={secondaryButtonClass}
                >
                  Delete
                </button>
              ) : confirmingDelete ? (
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => void remove('all')}
                  className={`${secondaryButtonClass} border-dusty-orange`}
                >
                  Confirm delete
                </button>
              ) : (
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => setConfirmingDelete(true)}
                  className={secondaryButtonClass}
                >
                  Delete
                </button>
              ))}
            <div className="ml-auto flex gap-3">
              <button type="button" onClick={onClose} className={secondaryButtonClass}>
                Cancel
              </button>
              <button type="submit" disabled={pending} className={primaryButtonClass}>
                {pending ? 'Saving…' : 'Save'}
              </button>
            </div>
          </div>
        </form>
      )}
    </Dialog>
  )
}
