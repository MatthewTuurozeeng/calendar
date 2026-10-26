import { describe, expect, it } from 'vitest'
import {
  DEFAULT_CALENDAR_PREFS,
  DEFAULT_DASHBOARD_PREFS,
  calendarPrefs,
  dashboardPrefs,
  formatOffset,
  notificationPrefs,
  readPrefs,
} from '../../src/features/settings/prefs'

describe('readPrefs', () => {
  it('falls back to defaults for an empty or non-object value', () => {
    expect(readPrefs({}, { a: 1 })).toEqual({ a: 1 })
    expect(readPrefs(null, { a: 1 })).toEqual({ a: 1 })
    expect(readPrefs([1, 2], { a: 1 })).toEqual({ a: 1 })
  })

  it('keeps stored values of the right type and drops the rest', () => {
    const stored = { a: 2, b: 'yes', c: [3], extra: true }
    expect(readPrefs(stored, { a: 1, b: false, c: [] as number[] })).toEqual({ a: 2, b: false, c: [3] })
  })
})

describe('calendarPrefs', () => {
  it('uses defaults for a new profile', () => {
    expect(calendarPrefs({ calendar_prefs: {} })).toEqual(DEFAULT_CALENDAR_PREFS)
  })

  it('reads stored choices', () => {
    const prefs = calendarPrefs({
      calendar_prefs: { default_view: 'dayGridMonth', time_format: '24h', show_weekends: false, day_start_hour: 8 },
    })
    expect(prefs).toMatchObject({
      default_view: 'dayGridMonth',
      time_format: '24h',
      show_weekends: false,
      day_start_hour: 8,
    })
  })

  it('ignores an unknown view or time format', () => {
    const prefs = calendarPrefs({ calendar_prefs: { default_view: 'year', time_format: 'military' } })
    expect(prefs.default_view).toBe('auto')
    expect(prefs.time_format).toBe(DEFAULT_CALENDAR_PREFS.time_format)
  })
})

describe('notificationPrefs', () => {
  it('keeps the all-day reminder time from sign-up defaults', () => {
    expect(notificationPrefs({ notification_prefs: {} }).all_day_reminder_time).toBe('08:00')
  })

  it('sorts default reminders and drops invalid offsets', () => {
    const prefs = notificationPrefs({ notification_prefs: { default_event_reminders: [30, 'x', 5, -1, 1.5] } })
    expect(prefs.default_event_reminders).toEqual([5, 30])
  })
})

describe('dashboardPrefs', () => {
  it('shows every section except free time by default', () => {
    expect(dashboardPrefs({ dashboard_prefs: {} })).toEqual(DEFAULT_DASHBOARD_PREFS)
    expect(DEFAULT_DASHBOARD_PREFS.free_gaps).toBe(false)
  })

  it('applies stored toggles', () => {
    expect(dashboardPrefs({ dashboard_prefs: { summary: false } }).summary).toBe(false)
  })
})

describe('formatOffset', () => {
  it.each([
    [0, 'At start'],
    [1, '1 minute'],
    [15, '15 minutes'],
    [60, '1 hour'],
    [90, '90 minutes'],
    [120, '2 hours'],
    [1440, '1 day'],
  ])('%i → %s', (minutes, label) => {
    expect(formatOffset(minutes)).toBe(label)
  })
})
