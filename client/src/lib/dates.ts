import { format, parseISO } from 'date-fns'

// All date and time-zone handling goes through this module (README §3).

export function browserTimeZone(): string {
  return Intl.DateTimeFormat().resolvedOptions().timeZone
}

/** 'yyyy-MM-dd' in local time, as used by `date` columns and date inputs. */
export function toDateString(date: Date): string {
  return format(date, 'yyyy-MM-dd')
}

/** 'HH:mm' in local time, as used by time inputs. */
export function toTimeString(date: Date): string {
  return format(date, 'HH:mm')
}

/** Parses a 'yyyy-MM-dd' date and optional 'HH:mm' time as local time, never UTC. */
export function parseLocal(date: string, time = '00:00'): Date {
  return parseISO(`${date}T${time}`)
}
