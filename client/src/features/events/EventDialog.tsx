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
import { notificationPrefs } from '../settings/prefs'
import { createEvent, deleteEvent, fetchEventsInRange, updateEvent, type EventRow } from './api'
import { defaultTiming, timingFromRow, timingToColumns, type EventTiming } from './timing'

type EventDialogProps = {
  /** The event to edit, or omit to create one at `timing`. */
  event?: EventRow
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
}

function initialForm(event: EventRow | undefined, timing: EventTiming): FormState {
  // The form shows the last day of an all-day event; storage keeps an exclusive end.
  const shownEnd = timing.allDay ? addDays(timing.end, -1) : timing.end
  return {
    title: event?.title ?? '',
    description: event?.description ?? '',
    location: event?.location ?? '',
    categoryId: event?.category_id ?? '',
    allDay: timing.allDay,
    startDate: toDateString(timing.start),
    startTime: timing.allDay ? '09:00' : toTimeString(timing.start),
    endDate: toDateString(shownEnd),
    endTime: timing.allDay ? '10:00' : toTimeString(timing.end),
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

export function EventDialog({ event, timing, onClose }: EventDialogProps) {
  const session = useSession()
  const { profile, categories } = useUserData()
  const titleId = useId()
  const [form, setForm] = useState(() =>
    initialForm(event, event ? timingFromRow(event) : (timing ?? defaultTiming())),
  )
  const [errors, setErrors] = useState<FieldErrors<'title' | 'start' | 'end'>>({})
  const [saveError, setSaveError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)
  const [confirmingDelete, setConfirmingDelete] = useState(false)
  const [overlaps, setOverlaps] = useState<string[]>([])

  const current = useMemo(() => formTiming(form), [form])
  const startMs = current.start.getTime()
  const endMs = current.end.getTime()

  // Overlaps are a warning only (README §4.1); they never block saving.
  useEffect(() => {
    if (current.allDay || !(endMs > startMs)) return
    let cancelled = false
    fetchEventsInRange(new Date(startMs), new Date(endMs))
      .then((rows) => {
        if (cancelled) return
        setOverlaps(rows.filter((r) => !r.all_day && r.id !== event?.id).map((r) => r.title))
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [current.allDay, startMs, endMs, event?.id])

  const visibleOverlaps = current.allDay || !(endMs > startMs) ? [] : overlaps

  function update(patch: Partial<FormState>) {
    setForm((prev) => ({ ...prev, ...patch }))
  }

  // Moving the start keeps the event's length, like most calendars.
  function updateStart(patch: Pick<Partial<FormState>, 'startDate' | 'startTime'>) {
    setForm((prev) => {
      const next = { ...prev, ...patch }
      const before = formTiming(prev)
      const after = formTiming(next)
      if (!isValid(before.start) || !isValid(before.end) || !isValid(after.start)) return next
      const newEnd = addMinutes(after.start, differenceInMinutes(before.end, before.start))
      const shownEnd = next.allDay ? addDays(newEnd, -1) : newEnd
      return { ...next, endDate: toDateString(shownEnd), endTime: next.allDay ? next.endTime : toTimeString(newEnd) }
    })
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    const found = validateEvent({ title: form.title, start: current.start, end: current.end })
    setErrors(found)
    if (Object.keys(found).length > 0) return

    const values = {
      title: form.title.trim(),
      description: form.description.trim() || null,
      location: form.location.trim() || null,
      category_id: form.categoryId || null,
      ...timingToColumns(current),
    }

    setPending(true)
    setSaveError(null)
    try {
      if (event) await updateEvent(event.id, values)
      else
        await createEvent({
          ...values,
          user_id: session.user.id,
          timezone: profile.timezone,
          reminder_offsets: notificationPrefs(profile).default_event_reminders,
        })
      onClose()
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Something went wrong while saving.')
      setPending(false)
    }
  }

  async function handleDelete() {
    if (!event) return
    setPending(true)
    setSaveError(null)
    try {
      await deleteEvent(event.id)
      onClose()
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Something went wrong while deleting.')
      setPending(false)
    }
  }

  return (
    <Dialog labelledBy={titleId} onClose={onClose}>
      <h2 id={titleId} className="text-lg font-semibold">
        {event ? 'Edit event' : 'New event'}
      </h2>

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
          {event &&
            (confirmingDelete ? (
              <button
                type="button"
                disabled={pending}
                onClick={handleDelete}
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
    </Dialog>
  )
}
