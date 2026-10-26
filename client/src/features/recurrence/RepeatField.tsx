import { addMonths } from 'date-fns'
import { errorClass, inputClass, labelClass } from '../../components/ui/form'
import {
  WEEKDAY_NAMES,
  defaultRepeat,
  describeRule,
  monthlyWeekdayLabel,
  skipsShortMonths,
  type Frequency,
  type RepeatConfig,
  type RepeatEnd,
} from './rule'

type RepeatFieldProps = {
  value: RepeatConfig | null
  onChange: (value: RepeatConfig | null) => void
  /** The first occurrence as a floating date (wall-clock time in UTC fields). */
  start: Date
  error?: string
}

const FREQUENCIES: { value: Frequency; label: string; unit: string }[] = [
  { value: 'daily', label: 'Daily', unit: 'day' },
  { value: 'weekly', label: 'Weekly', unit: 'week' },
  { value: 'monthly', label: 'Monthly', unit: 'month' },
  { value: 'yearly', label: 'Yearly', unit: 'year' },
]

export function RepeatField({ value, onChange, start, error }: RepeatFieldProps) {
  const update = (patch: Partial<RepeatConfig>) => value && onChange({ ...value, ...patch })
  const unit = FREQUENCIES.find((f) => f.value === value?.freq)?.unit ?? 'week'
  const startDate = start.toISOString().slice(0, 10)

  function setEnd(kind: RepeatEnd['kind']) {
    if (kind === 'never') update({ end: { kind } })
    if (kind === 'count') update({ end: { kind, count: 10 } })
    if (kind === 'until') {
      const [y, m, d] = startDate.split('-').map(Number)
      const inThreeMonths = addMonths(new Date(y, m - 1, d), 3)
      const pad = (n: number) => String(n).padStart(2, '0')
      update({
        end: {
          kind,
          date: `${inThreeMonths.getFullYear()}-${pad(inThreeMonths.getMonth() + 1)}-${pad(inThreeMonths.getDate())}`,
        },
      })
    }
  }

  function toggleWeekday(day: number) {
    if (!value) return
    const has = value.weekdays.includes(day)
    // Keep at least one day selected.
    if (has && value.weekdays.length === 1) return
    update({ weekdays: has ? value.weekdays.filter((d) => d !== day) : [...value.weekdays, day].sort() })
  }

  return (
    <div className="flex flex-col gap-3">
      <div>
        <label htmlFor="event-repeat" className={labelClass}>
          Repeat
        </label>
        <select
          id="event-repeat"
          className={inputClass}
          value={value?.freq ?? 'none'}
          onChange={(e) =>
            onChange(e.target.value === 'none' ? null : defaultRepeat(e.target.value as Frequency, start))
          }
        >
          <option value="none">Does not repeat</option>
          {FREQUENCIES.map((f) => (
            <option key={f.value} value={f.value}>
              {f.label}
            </option>
          ))}
        </select>
      </div>

      {value && (
        <div className="flex flex-col gap-4 rounded-xl bg-canvas p-4">
          <div className="flex flex-wrap items-center gap-2">
            <label htmlFor="repeat-interval">Every</label>
            <input
              id="repeat-interval"
              type="number"
              min={1}
              max={99}
              className={`${inputClass} w-20`}
              value={value.interval}
              onChange={(e) => update({ interval: Math.max(1, Math.min(99, Number(e.target.value) || 1)) })}
            />
            <span>
              {unit}
              {value.interval === 1 ? '' : 's'}
            </span>
          </div>

          {value.freq === 'weekly' && (
            <fieldset>
              <legend className={labelClass}>On</legend>
              <div className="flex flex-wrap gap-1">
                {WEEKDAY_NAMES.map((name, day) => {
                  const on = value.weekdays.includes(day)
                  return (
                    <button
                      key={name}
                      type="button"
                      aria-pressed={on}
                      aria-label={name}
                      title={name}
                      onClick={() => toggleWeekday(day)}
                      className={`grid size-11 place-items-center rounded-full text-sm font-medium ${
                        on ? 'bg-ink text-surface' : 'border border-line bg-surface text-ink-muted hover:text-ink'
                      }`}
                    >
                      {name.slice(0, 1)}
                    </button>
                  )
                })}
              </div>
            </fieldset>
          )}

          {value.freq === 'monthly' && (
            <div>
              <label htmlFor="repeat-monthly" className={labelClass}>
                On
              </label>
              <select
                id="repeat-monthly"
                className={inputClass}
                value={value.monthlyBy}
                onChange={(e) => update({ monthlyBy: e.target.value as RepeatConfig['monthlyBy'] })}
              >
                <option value="date">Day {start.getUTCDate()}</option>
                <option value="weekday">{monthlyWeekdayLabel(start).replace(/^the /, 'The ')}</option>
              </select>
              {skipsShortMonths(value, start) && (
                <p className="mt-1 text-xs text-ink-muted">Months without day {start.getUTCDate()} are skipped.</p>
              )}
            </div>
          )}

          <div>
            <label htmlFor="repeat-end" className={labelClass}>
              Ends
            </label>
            <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)] gap-3">
              <select
                id="repeat-end"
                className={inputClass}
                value={value.end.kind}
                onChange={(e) => setEnd(e.target.value as RepeatEnd['kind'])}
              >
                <option value="never">Never</option>
                <option value="until">On date</option>
                <option value="count">After</option>
              </select>
              {value.end.kind === 'until' && (
                <>
                  <label htmlFor="repeat-until" className="sr-only">
                    Last date
                  </label>
                  <input
                    id="repeat-until"
                    type="date"
                    min={startDate}
                    className={inputClass}
                    value={value.end.date}
                    onChange={(e) => update({ end: { kind: 'until', date: e.target.value } })}
                    aria-invalid={!!error}
                  />
                </>
              )}
              {value.end.kind === 'count' && (
                <div className="flex items-center gap-2">
                  <label htmlFor="repeat-count" className="sr-only">
                    Number of times
                  </label>
                  <input
                    id="repeat-count"
                    type="number"
                    min={1}
                    max={999}
                    className={`${inputClass} min-w-0`}
                    value={value.end.count}
                    onChange={(e) =>
                      update({ end: { kind: 'count', count: Math.max(1, Math.min(999, Number(e.target.value) || 1)) } })
                    }
                  />
                  <span className="shrink-0">times</span>
                </div>
              )}
            </div>
            {error && <p className={errorClass}>{error}</p>}
          </div>

          <p className="text-sm text-ink-muted">{describeRule(value, start)}</p>
        </div>
      )}
    </div>
  )
}
