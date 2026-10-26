import type { Json } from '../../types/database'
import type { Profile } from '../auth/user-data'
import type { CalendarView } from '../calendar/CalendarToolbar'

// Typed views of the jsonb preference columns on `profiles`. Stored values
// of the wrong type are ignored, so a missing or stale key never breaks the app.

export type CalendarPrefs = {
  /** 'auto' is Week on wide screens and Agenda on phones (README §4.1). */
  default_view: 'auto' | CalendarView
  time_format: '12h' | '24h'
  show_weekends: boolean
  show_week_numbers: boolean
  /** Hour the Day and Week views scroll to. */
  day_start_hour: number
  default_event_minutes: number
}

export type NotificationPrefs = {
  /** When all-day events and date-only tasks remind, 'HH:mm'. */
  all_day_reminder_time: string
  /** Minutes before start, applied to new events. */
  default_event_reminders: number[]
}

export const DASHBOARD_SECTIONS = [
  { id: 'next_event', label: 'Next event', description: 'With a countdown to when it starts.' },
  { id: 'timeline', label: "Today's timeline", description: 'Events scheduled for today.' },
  { id: 'tasks', label: 'Tasks', description: 'Due today and overdue.' },
  { id: 'summary', label: 'Completion summary', description: "How much of today's plan is done." },
  { id: 'intention', label: 'Daily intention', description: 'A short note for the day.' },
  { id: 'free_gaps', label: 'Free time', description: 'Gaps between your commitments.' },
] as const

export type DashboardPrefs = Record<(typeof DASHBOARD_SECTIONS)[number]['id'], boolean>

export const MODULES = [
  {
    id: 'academic',
    label: 'Academic planner',
    description: 'Semesters, courses, classes, quizzes, exams and assignments.',
  },
] as const

export const DEFAULT_CALENDAR_PREFS: CalendarPrefs = {
  default_view: 'auto',
  time_format: localeUses24h() ? '24h' : '12h',
  show_weekends: true,
  show_week_numbers: false,
  day_start_hour: 6,
  default_event_minutes: 60,
}

export const DEFAULT_NOTIFICATION_PREFS: NotificationPrefs = {
  all_day_reminder_time: '08:00',
  default_event_reminders: [],
}

export const DEFAULT_DASHBOARD_PREFS: DashboardPrefs = {
  next_event: true,
  timeline: true,
  tasks: true,
  summary: true,
  intention: true,
  free_gaps: false,
}

const VIEWS: CalendarPrefs['default_view'][] = ['auto', 'timeGridDay', 'timeGridWeek', 'dayGridMonth', 'listWeek']

function localeUses24h(): boolean {
  const { hourCycle } = new Intl.DateTimeFormat(undefined, { hour: 'numeric' }).resolvedOptions()
  return hourCycle === 'h23' || hourCycle === 'h24'
}

/** Overlays the stored object on `defaults`, keeping only keys whose type matches. */
export function readPrefs<T extends object>(stored: Json, defaults: T): T {
  const source = stored && typeof stored === 'object' && !Array.isArray(stored) ? stored : {}
  const result = { ...defaults }
  for (const key of Object.keys(defaults) as (keyof T & string)[]) {
    const value = source[key]
    const fallback = defaults[key]
    const matches = Array.isArray(fallback) ? Array.isArray(value) : typeof value === typeof fallback
    if (value !== undefined && value !== null && matches) result[key] = value as T[typeof key]
  }
  return result
}

export function calendarPrefs(profile: Pick<Profile, 'calendar_prefs'>): CalendarPrefs {
  const prefs = readPrefs(profile.calendar_prefs, DEFAULT_CALENDAR_PREFS)
  if (!VIEWS.includes(prefs.default_view)) prefs.default_view = DEFAULT_CALENDAR_PREFS.default_view
  if (prefs.time_format !== '12h' && prefs.time_format !== '24h') prefs.time_format = DEFAULT_CALENDAR_PREFS.time_format
  return prefs
}

export function notificationPrefs(profile: Pick<Profile, 'notification_prefs'>): NotificationPrefs {
  const prefs = readPrefs(profile.notification_prefs, DEFAULT_NOTIFICATION_PREFS)
  prefs.default_event_reminders = prefs.default_event_reminders
    .filter((m) => Number.isInteger(m) && m >= 0)
    .sort((a, b) => a - b)
  return prefs
}

export function dashboardPrefs(profile: Pick<Profile, 'dashboard_prefs'>): DashboardPrefs {
  return readPrefs(profile.dashboard_prefs, DEFAULT_DASHBOARD_PREFS)
}

/** 15 → '15 minutes', 60 → '1 hour', 1440 → '1 day'. */
export function formatOffset(minutes: number): string {
  const plural = (n: number, unit: string) => `${n} ${unit}${n === 1 ? '' : 's'}`
  if (minutes === 0) return 'At start'
  if (minutes % 1440 === 0) return plural(minutes / 1440, 'day')
  if (minutes % 60 === 0) return plural(minutes / 60, 'hour')
  return plural(minutes, 'minute')
}
