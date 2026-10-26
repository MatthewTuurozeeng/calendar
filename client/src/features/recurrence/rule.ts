import { format } from 'date-fns'

// The repeat options the event form offers, and their RFC 5545 RRULE form.
// Rules are anchored to a series start given as a *floating* date: a Date
// whose UTC fields hold the wall-clock time in the event's time zone (see expand.ts).
// UNTIL is the end of the last day, also floating: UNTIL=20261231T235959Z.

export type Frequency = 'daily' | 'weekly' | 'monthly' | 'yearly'

export type RepeatEnd = { kind: 'never' } | { kind: 'until'; date: string } | { kind: 'count'; count: number }

export type RepeatConfig = {
  freq: Frequency
  interval: number
  /** Weekly only: 0 = Sunday … 6 = Saturday. */
  weekdays: number[]
  /** Monthly only: the same date each month, or e.g. "the 2nd Tuesday". */
  monthlyBy: 'date' | 'weekday'
  end: RepeatEnd
}

const DAY_CODES = ['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA']
const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
const ORDINALS: Record<number, string> = { 1: 'first', 2: 'second', 3: 'third', 4: 'fourth', [-1]: 'last' }

/** Which week of the month the start falls in: 1–4, or -1 for the fifth (last) week. */
export function weekOfMonth(start: Date): number {
  const n = Math.ceil(start.getUTCDate() / 7)
  return n > 4 ? -1 : n
}

export function defaultRepeat(freq: Frequency, start: Date): RepeatConfig {
  return { freq, interval: 1, weekdays: [start.getUTCDay()], monthlyBy: 'date', end: { kind: 'never' } }
}

export function buildRule(config: RepeatConfig, start: Date): string {
  const parts = [`FREQ=${config.freq.toUpperCase()}`]
  if (config.interval > 1) parts.push(`INTERVAL=${config.interval}`)
  if (config.freq === 'weekly') {
    const days = config.weekdays.length > 0 ? [...new Set(config.weekdays)].sort() : [start.getUTCDay()]
    parts.push(`BYDAY=${days.map((d) => DAY_CODES[d]).join(',')}`)
  }
  if (config.freq === 'monthly' && config.monthlyBy === 'weekday') {
    parts.push(`BYDAY=${weekOfMonth(start)}${DAY_CODES[start.getUTCDay()]}`)
  }
  if (config.end.kind === 'until') parts.push(`UNTIL=${config.end.date.replaceAll('-', '')}T235959Z`)
  if (config.end.kind === 'count') parts.push(`COUNT=${config.end.count}`)
  return parts.join(';')
}

/** Reads a rule written by buildRule. */
export function parseRule(rule: string): RepeatConfig {
  const fields = new Map(
    rule
      .replace(/^RRULE:/, '')
      .split(';')
      .map((part) => part.split('=') as [string, string]),
  )
  const freq = (fields.get('FREQ')?.toLowerCase() ?? 'weekly') as Frequency
  const byDay = fields.get('BYDAY')?.split(',') ?? []
  const until = fields.get('UNTIL')
  const count = fields.get('COUNT')

  return {
    freq,
    interval: Number(fields.get('INTERVAL') ?? 1),
    weekdays: freq === 'weekly' ? byDay.map((code) => DAY_CODES.indexOf(code)).filter((d) => d >= 0) : [],
    monthlyBy: freq === 'monthly' && byDay.some((code) => /^-?\d/.test(code)) ? 'weekday' : 'date',
    end: until
      ? { kind: 'until', date: `${until.slice(0, 4)}-${until.slice(4, 6)}-${until.slice(6, 8)}` }
      : count
        ? { kind: 'count', count: Number(count) }
        : { kind: 'never' },
  }
}

/** Ends a rule on the given day ('yyyy-MM-dd'), dropping any COUNT. */
export function endRuleOn(rule: string, lastDate: string): string {
  const kept = rule
    .replace(/^RRULE:/, '')
    .split(';')
    .filter((part) => !part.startsWith('UNTIL=') && !part.startsWith('COUNT='))
  return [...kept, `UNTIL=${lastDate.replaceAll('-', '')}T235959Z`].join(';')
}

/** "Every 2 weeks on Monday and Wednesday, until 31 Dec 2026". */
export function describeRule(config: RepeatConfig, start: Date): string {
  const unit = { daily: 'day', weekly: 'week', monthly: 'month', yearly: 'year' }[config.freq]
  let text = config.interval > 1 ? `Every ${config.interval} ${unit}s` : `Every ${unit}`

  if (config.freq === 'weekly') {
    const days = config.weekdays.length > 0 ? [...config.weekdays].sort() : [start.getUTCDay()]
    if (days.length === 7) text += ' on every day'
    else if (days.join() === '1,2,3,4,5') text += ' on weekdays'
    else text += ` on ${listJoin(days.map((d) => DAY_NAMES[d]))}`
  } else if (config.freq === 'monthly') {
    text +=
      config.monthlyBy === 'weekday'
        ? ` on the ${ORDINALS[weekOfMonth(start)]} ${DAY_NAMES[start.getUTCDay()]}`
        : ` on day ${start.getUTCDate()}`
  } else if (config.freq === 'yearly') {
    text += ` on ${start.getUTCDate()} ${format(new Date(2000, start.getUTCMonth(), 1), 'MMMM')}`
  }

  if (config.end.kind === 'until') {
    const [y, m, d] = config.end.date.split('-').map(Number)
    text += `, until ${format(new Date(y, m - 1, d), 'd MMM yyyy')}`
  }
  if (config.end.kind === 'count') text += `, ${config.end.count} time${config.end.count === 1 ? '' : 's'}`
  return text
}

/** Day numbers past the 28th are skipped in shorter months, as in other calendars. */
export function skipsShortMonths(config: RepeatConfig, start: Date): boolean {
  return config.freq === 'monthly' && config.monthlyBy === 'date' && start.getUTCDate() > 28
}

export function monthlyWeekdayLabel(start: Date): string {
  return `the ${ORDINALS[weekOfMonth(start)]} ${DAY_NAMES[start.getUTCDay()]}`
}

function listJoin(items: string[]): string {
  return items.length < 2 ? items.join('') : `${items.slice(0, -1).join(', ')} and ${items[items.length - 1]}`
}

export const WEEKDAY_NAMES = DAY_NAMES
