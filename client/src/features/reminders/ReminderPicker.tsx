import { useId, useState } from 'react'
import { inputClass, labelClass } from '../../components/ui/form'
import { XIcon } from '../../components/ui/icons'
import { formatOffset } from '../settings/prefs'

type ReminderPickerProps = {
  value: number[]
  onChange: (offsets: number[]) => void
  /** Preset offsets in minutes; 0 means "at the start" (or "when due"). */
  presets?: number[]
  atStartLabel?: string
  hint?: string
}

const MAX_OFFSET = 7 * 24 * 60

function chipLabel(minutes: number, atStartLabel: string) {
  return minutes === 0 ? atStartLabel : `${formatOffset(minutes).replace(/minutes?/, 'min')} before`
}

/** Reminder offsets (README §4.5): presets as toggles, plus any custom number of minutes. */
export function ReminderPicker({
  value,
  onChange,
  presets = [5, 15, 30, 60],
  atStartLabel = 'At start',
  hint,
}: ReminderPickerProps) {
  const id = useId()
  const [custom, setCustom] = useState('')
  const customOffsets = value.filter((m) => !presets.includes(m))
  const customMinutes = Number(custom)
  const customValid = /^\d+$/.test(custom) && customMinutes <= MAX_OFFSET

  const set = (next: number[]) => onChange([...new Set(next)].sort((a, b) => a - b))
  const toggle = (minutes: number) =>
    set(value.includes(minutes) ? value.filter((m) => m !== minutes) : [...value, minutes])

  function addCustom() {
    if (!customValid) return
    set([...value, customMinutes])
    setCustom('')
  }

  const chip = (on: boolean) =>
    `inline-flex min-h-11 items-center gap-1 rounded-full border px-3 text-sm ${
      on ? 'border-transparent bg-soft-rose/60 font-medium' : 'border-line text-ink-muted hover:bg-canvas'
    }`

  return (
    <fieldset>
      <legend className={labelClass}>Reminders</legend>
      <div className="flex flex-wrap gap-2">
        {presets.map((minutes) => (
          <button
            key={minutes}
            type="button"
            aria-pressed={value.includes(minutes)}
            onClick={() => toggle(minutes)}
            className={chip(value.includes(minutes))}
          >
            {chipLabel(minutes, atStartLabel)}
          </button>
        ))}
        {customOffsets.map((minutes) => (
          <button
            key={minutes}
            type="button"
            onClick={() => toggle(minutes)}
            className={chip(true)}
            aria-label={`Remove reminder ${chipLabel(minutes, atStartLabel)}`}
          >
            {chipLabel(minutes, atStartLabel)}
            <XIcon className="size-4" />
          </button>
        ))}
      </div>
      <div className="mt-2 flex items-center gap-2">
        <label htmlFor={`${id}-custom`} className="text-sm text-ink-muted">
          Other
        </label>
        <input
          id={`${id}-custom`}
          inputMode="numeric"
          className={`${inputClass} min-h-10 w-24`}
          value={custom}
          onChange={(e) => setCustom(e.target.value)}
          onKeyDown={(e) => {
            if (e.key !== 'Enter') return
            e.preventDefault()
            addCustom()
          }}
          placeholder="min"
        />
        <span className="text-sm text-ink-muted">minutes before</span>
        <button
          type="button"
          onClick={addCustom}
          disabled={!customValid}
          className="min-h-10 rounded-lg px-3 text-sm font-medium hover:bg-canvas disabled:opacity-40"
        >
          Add
        </button>
      </div>
      {hint && <p className="mt-1 text-xs text-ink-muted">{hint}</p>}
    </fieldset>
  )
}
