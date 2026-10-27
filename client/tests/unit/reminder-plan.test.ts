import { describe, expect, it } from 'vitest'
import {
  atTime,
  planReminders,
  type EventInput,
  type ExceptionInput,
  type PlanInput,
  type TaskInput,
} from '../../../server/supabase/functions/_shared/reminder-plan.ts'

const NY = 'America/New_York'
// Monday 26 Oct 2026, 12:00 UTC (08:00 in New York)
const now = new Date('2026-10-26T12:00:00Z')

function event(overrides: Partial<EventInput> = {}): EventInput {
  return {
    id: 'e1',
    user_id: 'u1',
    all_day: false,
    start_at: '2026-10-26T14:00:00.000Z', // 10:00 EDT
    end_at: '2026-10-26T15:00:00.000Z',
    start_date: null,
    end_date: null,
    timezone: NY,
    rrule: null,
    reminder_offsets: [15],
    ...overrides,
  }
}

function task(overrides: Partial<TaskInput> = {}): TaskInput {
  return { id: 't1', user_id: 'u1', status: 'pending', due_at: null, due_date: null, reminder_offsets: [0], ...overrides }
}

function plan(overrides: Partial<PlanInput>) {
  return planReminders(
    { events: [], exceptions: [], tasks: [], timeZone: NY, allDayReminderTime: '08:00', ...overrides },
    now,
  )
}

describe('planReminders', () => {
  it('reminds before a one-off event, keyed by its start and offset', () => {
    const [row] = plan({ events: [event({ reminder_offsets: [15] })] })
    expect(row).toMatchObject({
      event_id: 'e1',
      task_id: null,
      offset_minutes: 15,
      remind_at: '2026-10-26T13:45:00.000Z',
      idempotency_key: 'event:e1:2026-10-26T14:00:00.000Z:15',
    })
  })

  it('makes one row per offset and skips reminders already in the past', () => {
    // Starts 12:30 UTC: 15 min before is in the future, 60 min before has passed.
    const rows = plan({ events: [event({ start_at: '2026-10-26T12:30:00.000Z', reminder_offsets: [15, 60] })] })
    expect(rows.map((r) => r.offset_minutes)).toEqual([15])
  })

  it('covers 14 days of a weekly series, at local time across DST', () => {
    const rows = plan({ events: [event({ rrule: 'FREQ=WEEKLY;BYDAY=MO', reminder_offsets: [0] })] })
    expect(rows.map((r) => r.remind_at)).toEqual([
      '2026-10-26T14:00:00.000Z',
      '2026-11-02T15:00:00.000Z', // clocks went back on 1 Nov
    ])
  })

  it('skips cancelled occurrences and follows moved ones', () => {
    const exceptions: ExceptionInput[] = [
      {
        event_id: 'e1',
        original_start: '2026-10-26T14:00:00+00:00',
        original_date: null,
        is_cancelled: true,
        new_start_at: null,
        new_start_date: null,
      },
      {
        event_id: 'e1',
        original_start: '2026-11-02T15:00:00+00:00',
        original_date: null,
        is_cancelled: false,
        new_start_at: '2026-11-03T15:00:00+00:00',
        new_start_date: null,
      },
    ]
    const rows = plan({ events: [event({ rrule: 'FREQ=WEEKLY;BYDAY=MO', reminder_offsets: [0] })], exceptions })
    expect(rows.map((r) => [r.remind_at, r.occurrence_start])).toEqual([
      ['2026-11-03T15:00:00.000Z', '2026-11-02T15:00:00.000Z'],
    ])
  })

  it('reminds all-day events at the all-day reminder time in the event zone', () => {
    const rows = plan({
      events: [
        event({
          all_day: true,
          start_at: null,
          end_at: null,
          start_date: '2026-10-27',
          end_date: '2026-10-28',
          reminder_offsets: [0, 1440],
        }),
      ],
    })
    expect(rows.map((r) => r.remind_at)).toEqual([
      '2026-10-27T12:00:00.000Z', // 08:00 EDT on the day
      '2026-10-26T12:00:00.000Z', // a day before, which is exactly now
    ])
  })

  it('reminds tasks when due, and date-only tasks at the reminder time', () => {
    const rows = plan({
      tasks: [
        task({ id: 'timed', due_at: '2026-10-26T20:00:00.000Z' }),
        task({ id: 'dated', due_date: '2026-10-27', reminder_offsets: [60] }),
        task({ id: 'done', status: 'completed', due_at: '2026-10-26T20:00:00.000Z' }),
        task({ id: 'undated' }),
      ],
    })
    expect(rows.map((r) => [r.task_id, r.remind_at, r.idempotency_key])).toEqual([
      ['timed', '2026-10-26T20:00:00.000Z', 'task:timed:2026-10-26T20:00:00.000Z:0'],
      ['dated', '2026-10-27T11:00:00.000Z', 'task:dated:2026-10-27:60'],
    ])
  })

  it('stops at the end of the 14-day window', () => {
    const rows = plan({ events: [event({ rrule: 'FREQ=DAILY', reminder_offsets: [0] })] })
    expect(rows).toHaveLength(14)
    expect(rows.at(-1)!.remind_at).toBe('2026-11-08T15:00:00.000Z')
  })

  it('converts a local date and time to an instant', () => {
    expect(atTime('2026-11-02', '08:00', NY).toISOString()).toBe('2026-11-02T13:00:00.000Z')
  })
})
