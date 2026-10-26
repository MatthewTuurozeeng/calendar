import { format, setHours, startOfDay } from 'date-fns'
import { useEffect, useMemo, useState } from 'react'
import { inputClass, secondaryButtonClass } from '../../components/ui/form'
import { Switch } from '../../components/ui/Switch'
import { browserTimeZone, timeZoneOptions } from '../../lib/dates'
import { useUserData } from '../auth/user-data'
import { AccountSettings } from './AccountSettings'
import { CategorySettings } from './CategorySettings'
import {
  DASHBOARD_SECTIONS,
  MODULES,
  calendarPrefs,
  dashboardPrefs,
  formatOffset,
  notificationPrefs,
  type CalendarPrefs,
  type DashboardPrefs,
  type NotificationPrefs,
} from './prefs'
import { SaveToast } from './SaveToast'
import { useSaveStatus } from './save-status'
import { SettingRow, SettingsSection } from './SettingsLayout'

const SECTIONS = [
  { id: 'general', label: 'General' },
  { id: 'date-time', label: 'Date & time' },
  { id: 'view', label: 'View options' },
  { id: 'notifications', label: 'Notifications' },
  { id: 'categories', label: 'Categories' },
  { id: 'today', label: 'Today page' },
  { id: 'modules', label: 'Modules' },
  { id: 'account', label: 'Account' },
]

const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
// The usual choices; any other stored day is still shown.
const WEEK_START_CHOICES = [6, 0, 1]

const VIEW_CHOICES: { value: CalendarPrefs['default_view']; label: string }[] = [
  { value: 'auto', label: 'Automatic' },
  { value: 'timeGridDay', label: 'Day' },
  { value: 'timeGridWeek', label: 'Week' },
  { value: 'dayGridMonth', label: 'Month' },
  { value: 'listWeek', label: 'Agenda' },
]

const DURATION_CHOICES = [15, 30, 45, 60, 90, 120]
const REMINDER_CHOICES = [0, 5, 10, 15, 30, 60, 1440]

export function SettingsPage() {
  const { profile, updateProfile } = useUserData()
  const { status, track, dismiss } = useSaveStatus()
  const activeSection = useActiveSection()

  const calendar = calendarPrefs(profile)
  const notifications = notificationPrefs(profile)
  const dashboard = dashboardPrefs(profile)

  const save = (patch: Parameters<typeof updateProfile>[0]) => void track(() => updateProfile(patch))
  const saveCalendar = (patch: Partial<CalendarPrefs>) => save({ calendar_prefs: { ...calendar, ...patch } })
  const saveNotifications = (patch: Partial<NotificationPrefs>) =>
    save({ notification_prefs: { ...notifications, ...patch } })
  const saveDashboard = (patch: Partial<DashboardPrefs>) => save({ dashboard_prefs: { ...dashboard, ...patch } })

  const formatHour = (hour: number) =>
    format(setHours(startOfDay(new Date()), hour), calendar.time_format === '24h' ? 'HH:mm' : 'h a')

  function toggleReminder(minutes: number) {
    const current = notifications.default_event_reminders
    const next = current.includes(minutes) ? current.filter((m) => m !== minutes) : [...current, minutes]
    saveNotifications({ default_event_reminders: next.sort((a, b) => a - b) })
  }

  function toggleModule(id: string, on: boolean) {
    const rest = profile.enabled_modules.filter((m) => m !== id)
    save({ enabled_modules: on ? [...rest, id] : rest })
  }

  return (
    <div className="lg:grid lg:grid-cols-[11rem_minmax(0,1fr)] lg:gap-10">
      <nav aria-label="Settings sections" className="sticky top-24 hidden self-start lg:block">
        <ul className="flex flex-col gap-0.5">
          {SECTIONS.map(({ id, label }) => (
            <li key={id}>
              <a
                href={`#${id}`}
                aria-current={activeSection === id ? 'true' : undefined}
                className={`flex min-h-10 items-center rounded-xl px-3 text-sm ${
                  activeSection === id ? 'bg-soft-rose/45 font-semibold' : 'text-ink-muted hover:bg-surface'
                }`}
              >
                {label}
              </a>
            </li>
          ))}
        </ul>
      </nav>

      <div className="flex max-w-3xl min-w-0 flex-col gap-6">
        <SettingsSection id="general" title="General">
          <SettingRow id="display-name" label="Name">
            <DisplayNameInput value={profile.display_name ?? ''} onSave={(name) => save({ display_name: name || null })} />
          </SettingRow>
        </SettingsSection>

        <SettingsSection id="date-time" title="Date & time">
          <SettingRow
            id="timezone"
            label="Time zone"
            description={<TimeZoneHint timezone={profile.timezone} onUseDevice={(tz) => save({ timezone: tz })} />}
          >
            <TimeZoneSelect value={profile.timezone} onChange={(tz) => save({ timezone: tz })} />
          </SettingRow>

          <SettingRow id="week-start" label="Start of week">
            <select
              id="week-start"
              className={inputClass}
              value={profile.week_starts_on}
              onChange={(e) => save({ week_starts_on: Number(e.target.value) })}
            >
              {[...new Set([...WEEK_START_CHOICES, profile.week_starts_on])].map((day) => (
                <option key={day} value={day}>
                  {WEEKDAYS[day]}
                </option>
              ))}
            </select>
          </SettingRow>

          <SettingRow id="time-format" label="Time format">
            <select
              id="time-format"
              className={inputClass}
              value={calendar.time_format}
              onChange={(e) => saveCalendar({ time_format: e.target.value as CalendarPrefs['time_format'] })}
            >
              <option value="12h">1:00 PM</option>
              <option value="24h">13:00</option>
            </select>
          </SettingRow>
        </SettingsSection>

        <SettingsSection id="view" title="View options">
          <SettingRow
            id="default-view"
            label="Default view"
            description="Automatic opens Week on larger screens and Agenda on phones."
          >
            <select
              id="default-view"
              className={inputClass}
              value={calendar.default_view}
              aria-describedby="default-view-description"
              onChange={(e) => saveCalendar({ default_view: e.target.value as CalendarPrefs['default_view'] })}
            >
              {VIEW_CHOICES.map(({ value, label }) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </SettingRow>

          <SettingRow
            id="day-start"
            label="Day starts at"
            description="Where Day and Week views open. Earlier hours stay a scroll away."
          >
            <select
              id="day-start"
              className={inputClass}
              value={calendar.day_start_hour}
              aria-describedby="day-start-description"
              onChange={(e) => saveCalendar({ day_start_hour: Number(e.target.value) })}
            >
              {Array.from({ length: 13 }, (_, hour) => (
                <option key={hour} value={hour}>
                  {formatHour(hour)}
                </option>
              ))}
            </select>
          </SettingRow>

          <SettingRow id="default-duration" label="Default event duration" description="Used by New event.">
            <select
              id="default-duration"
              className={inputClass}
              value={calendar.default_event_minutes}
              aria-describedby="default-duration-description"
              onChange={(e) => saveCalendar({ default_event_minutes: Number(e.target.value) })}
            >
              {[...new Set([...DURATION_CHOICES, calendar.default_event_minutes])]
                .sort((a, b) => a - b)
                .map((minutes) => (
                  <option key={minutes} value={minutes}>
                    {formatOffset(minutes)}
                  </option>
                ))}
            </select>
          </SettingRow>

          <SettingRow id="show-weekends" label="Show weekends" inline>
            <Switch
              id="show-weekends"
              checked={calendar.show_weekends}
              onChange={(on) => saveCalendar({ show_weekends: on })}
            />
          </SettingRow>

          <SettingRow id="show-week-numbers" label="Show week numbers" inline>
            <Switch
              id="show-week-numbers"
              checked={calendar.show_week_numbers}
              onChange={(on) => saveCalendar({ show_week_numbers: on })}
            />
          </SettingRow>
        </SettingsSection>

        <SettingsSection id="notifications" title="Notifications">
          <SettingRow
            id="default-reminders"
            label="Default event reminders"
            description="Added to each new event. Pick any number."
          >
            <div
              id="default-reminders"
              role="group"
              aria-labelledby="default-reminders-label"
              aria-describedby="default-reminders-description"
              className="flex flex-wrap gap-2"
            >
              {REMINDER_CHOICES.map((minutes) => {
                const on = notifications.default_event_reminders.includes(minutes)
                return (
                  <button
                    key={minutes}
                    type="button"
                    aria-pressed={on}
                    onClick={() => toggleReminder(minutes)}
                    className={`min-h-11 rounded-full border px-3 text-sm ${
                      on ? 'border-transparent bg-soft-rose/60 font-medium' : 'border-line text-ink-muted hover:bg-canvas'
                    }`}
                  >
                    {minutes === 0 ? 'At start' : formatOffset(minutes).replace(/minutes?/, 'min')}
                  </button>
                )
              })}
            </div>
          </SettingRow>

          <SettingRow
            id="all-day-reminder-time"
            label="All-day reminder time"
            description="All-day events and tasks due on a date remind at this time."
          >
            <TimeInput
              id="all-day-reminder-time"
              value={notifications.all_day_reminder_time}
              onSave={(time) => saveNotifications({ all_day_reminder_time: time })}
            />
          </SettingRow>
        </SettingsSection>

        <SettingsSection
          id="categories"
          title="Categories"
          description="Color-code events and tasks by area of life. Archived categories keep their color on past events."
        >
          <CategorySettings track={track} />
        </SettingsSection>

        <SettingsSection id="today" title="Today page" description="Choose what your daily overview shows.">
          {DASHBOARD_SECTIONS.map(({ id, label, description }) => (
            <SettingRow key={id} id={`today-${id}`} label={label} description={description} inline>
              <Switch
                id={`today-${id}`}
                checked={dashboard[id]}
                onChange={(on) => saveDashboard({ [id]: on })}
                aria-describedby={`today-${id}-description`}
              />
            </SettingRow>
          ))}
        </SettingsSection>

        <SettingsSection
          id="modules"
          title="Modules"
          description="Optional planners that build on your calendar. Turning one off hides it; nothing is deleted."
        >
          {MODULES.map(({ id, label, description }) => (
            <SettingRow key={id} id={`module-${id}`} label={label} description={description} inline>
              <Switch
                id={`module-${id}`}
                checked={profile.enabled_modules.includes(id)}
                onChange={(on) => toggleModule(id, on)}
                aria-describedby={`module-${id}-description`}
              />
            </SettingRow>
          ))}
        </SettingsSection>

        <SettingsSection id="account" title="Account">
          <AccountSettings track={track} />
        </SettingsSection>
      </div>

      <SaveToast status={status} onDismiss={dismiss} />
    </div>
  )
}

/** The section nearest the top of the viewport, for the side navigation. */
function useActiveSection() {
  const [active, setActive] = useState(SECTIONS[0].id)

  useEffect(() => {
    const visible = new Map<string, number>()
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) visible.set(entry.target.id, entry.boundingClientRect.top)
          else visible.delete(entry.target.id)
        }
        const first = SECTIONS.find(({ id }) => visible.has(id))
        if (first) setActive(first.id)
      },
      // A band near the top of the screen, below the sticky header.
      { rootMargin: '-80px 0px -55% 0px' },
    )
    for (const { id } of SECTIONS) {
      const el = document.getElementById(id)
      if (el) observer.observe(el)
    }
    return () => observer.disconnect()
  }, [])

  return active
}

function DisplayNameInput({ value, onSave }: { value: string; onSave: (name: string) => void }) {
  const [draft, setDraft] = useState(value)

  function commit() {
    const trimmed = draft.trim()
    setDraft(trimmed)
    if (trimmed !== value) onSave(trimmed)
  }

  return (
    <input
      id="display-name"
      className={inputClass}
      value={draft}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
      autoComplete="name"
      maxLength={80}
    />
  )
}

function TimeInput({ id, value, onSave }: { id: string; value: string; onSave: (time: string) => void }) {
  const [draft, setDraft] = useState(value)

  return (
    <input
      id={id}
      type="time"
      className={inputClass}
      value={draft}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={() => {
        if (/^\d{2}:\d{2}$/.test(draft) && draft !== value) onSave(draft)
        else setDraft(value)
      }}
      aria-describedby={`${id}-description`}
    />
  )
}

function TimeZoneSelect({ value, onChange }: { value: string; onChange: (tz: string) => void }) {
  const options = useMemo(() => {
    const all = timeZoneOptions()
    // Keep a stored zone the browser doesn't list (e.g. 'UTC') selectable.
    return all.some((o) => o.id === value) ? all : [{ id: value, label: value }, ...all]
  }, [value])

  return (
    <select
      id="timezone"
      className={inputClass}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      aria-describedby="timezone-description"
    >
      {options.map(({ id, label }) => (
        <option key={id} value={id}>
          {label}
        </option>
      ))}
    </select>
  )
}

function TimeZoneHint({ timezone, onUseDevice }: { timezone: string; onUseDevice: (tz: string) => void }) {
  const device = browserTimeZone()
  if (device === timezone) return <>New events and reminders use this zone.</>
  return (
    <>
      This device is set to <span className="font-medium text-ink">{device.replaceAll('_', ' ')}</span>.{' '}
      <button
        type="button"
        onClick={() => onUseDevice(device)}
        className={`${secondaryButtonClass} mt-2 min-h-9 px-3 text-sm`}
      >
        Use device time zone
      </button>
    </>
  )
}
