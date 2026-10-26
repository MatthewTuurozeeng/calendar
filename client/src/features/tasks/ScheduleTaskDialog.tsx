import { addMinutes, isValid } from 'date-fns'
import { useEffect, useId, useState, type FormEvent } from 'react'
import { Dialog } from '../../components/ui/Dialog'
import { errorClass, inputClass, labelClass, primaryButtonClass, secondaryButtonClass } from '../../components/ui/form'
import { parseLocal, toDateString, toTimeString } from '../../lib/dates'
import { useUserData } from '../auth/user-data'
import { fetchOccurrences } from '../recurrence/api'
import { calendarPrefs, formatOffset } from '../settings/prefs'
import { scheduleTask, type Task, type TimeBlock } from './api'
import { suggestBlock } from './views'

type ScheduleTaskDialogProps = {
  task: Task
  onScheduled?: (block: TimeBlock) => void
  onClose: () => void
}

const DURATIONS = [15, 30, 45, 60, 90, 120, 180, 240]

/** "Schedule this task": books a time block for it on the calendar. */
export function ScheduleTaskDialog({ task, onScheduled, onClose }: ScheduleTaskDialogProps) {
  const { profile } = useUserData()
  const titleId = useId()
  const [suggested] = useState(() =>
    suggestBlock(task, new Date(), calendarPrefs(profile).default_event_minutes),
  )
  const [date, setDate] = useState(toDateString(suggested.start))
  const [time, setTime] = useState(toTimeString(suggested.start))
  const [minutes, setMinutes] = useState((suggested.end.getTime() - suggested.start.getTime()) / 60_000)
  const [overlaps, setOverlaps] = useState<string[]>([])
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)

  const start = parseLocal(date, time)
  const valid = isValid(start)
  const startMs = valid ? start.getTime() : NaN

  // A warning only, as for events (README §4.1).
  useEffect(() => {
    if (Number.isNaN(startMs)) return
    let cancelled = false
    fetchOccurrences(new Date(startMs), addMinutes(new Date(startMs), minutes))
      .then((found) => !cancelled && setOverlaps(found.filter((o) => !o.timing.allDay).map((o) => o.title)))
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [startMs, minutes])

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!valid) return setError('Enter a valid date and time.')
    setPending(true)
    setError(null)
    try {
      const block = await scheduleTask(
        task,
        { allDay: false, start, end: addMinutes(start, minutes) },
        profile.timezone,
      )
      onScheduled?.(block)
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not schedule the task.')
      setPending(false)
    }
  }

  const durations = [...new Set([...DURATIONS, minutes])].sort((a, b) => a - b)

  return (
    <Dialog labelledBy={titleId} onClose={onClose}>
      <h2 id={titleId} className="text-lg font-semibold">
        Schedule task
      </h2>
      <p className="mt-1 text-ink-muted">{task.title}</p>

      <form onSubmit={handleSubmit} noValidate className="mt-5 flex flex-col gap-4">
        <div className="grid grid-cols-[1fr_auto] gap-3">
          <div>
            <label htmlFor="block-date" className={labelClass}>
              Date
            </label>
            <input
              id="block-date"
              type="date"
              className={inputClass}
              value={date}
              onChange={(e) => setDate(e.target.value)}
              autoFocus
            />
          </div>
          <div>
            <label htmlFor="block-time" className={labelClass}>
              Start
            </label>
            <input
              id="block-time"
              type="time"
              className={inputClass}
              value={time}
              onChange={(e) => setTime(e.target.value)}
            />
          </div>
        </div>

        <div>
          <label htmlFor="block-duration" className={labelClass}>
            Duration
          </label>
          <select
            id="block-duration"
            className={inputClass}
            value={minutes}
            onChange={(e) => setMinutes(Number(e.target.value))}
          >
            {durations.map((m) => (
              <option key={m} value={m}>
                {formatOffset(m)}
                {m === task.estimated_minutes ? ' (estimate)' : ''}
              </option>
            ))}
          </select>
        </div>

        {overlaps.length > 0 && (
          <p role="status" className="rounded-xl bg-warm-peach/25 px-3 py-2 text-sm">
            <span className="font-medium">Overlaps with </span>
            {overlaps.join(', ')}
          </p>
        )}

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
            {pending ? 'Scheduling…' : 'Add to calendar'}
          </button>
        </div>
      </form>
    </Dialog>
  )
}
