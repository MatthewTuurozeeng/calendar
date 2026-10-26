import { describe, expect, it } from 'vitest'
import {
  blockLabel,
  compareTasks,
  countByView,
  dayLabel,
  defaultDueDate,
  dueLabel,
  groupByDueDay,
  suggestBlock,
  taskView,
  tasksForView,
  taskViewFromParams,
  upcomingBlocks,
} from '../../src/features/tasks/views'

// Monday 26 October 2026, 14:00 local time
const now = new Date(2026, 9, 26, 14, 0)

function task(overrides: Partial<Parameters<typeof compareTasks>[0]> & { id?: string } = {}) {
  return {
    id: 'x',
    status: 'pending',
    priority: 'medium',
    due_at: null,
    due_date: null,
    completed_at: null,
    created_at: '2026-10-01T00:00:00Z',
    ...overrides,
  }
}

describe('taskView', () => {
  it('puts completed tasks in Completed whatever their due date', () => {
    expect(taskView(task({ status: 'completed', due_date: '2026-10-01' }), now)).toBe('completed')
  })

  it('sorts date-only tasks by calendar day', () => {
    expect(taskView(task({ due_date: '2026-10-25' }), now)).toBe('overdue')
    expect(taskView(task({ due_date: '2026-10-26' }), now)).toBe('today')
    expect(taskView(task({ due_date: '2026-10-27' }), now)).toBe('upcoming')
  })

  it('makes a timed task overdue once its time has passed', () => {
    expect(taskView(task({ due_at: new Date(2026, 9, 26, 9).toISOString() }), now)).toBe('overdue')
    expect(taskView(task({ due_at: new Date(2026, 9, 26, 18).toISOString() }), now)).toBe('today')
    expect(taskView(task({ due_at: new Date(2026, 9, 27, 9).toISOString() }), now)).toBe('upcoming')
  })

  it('keeps in-progress tasks in their due view', () => {
    expect(taskView(task({ status: 'in_progress', due_date: '2026-10-26' }), now)).toBe('today')
  })

  it('lists tasks with no due date under Upcoming', () => {
    expect(taskView(task(), now)).toBe('upcoming')
  })
})

describe('tasksForView', () => {
  it('orders by due time, then priority, with date-only after timed on the same day', () => {
    const tasks = [
      task({ id: 'date-only', due_date: '2026-10-26', priority: 'high' }),
      task({ id: 'evening', due_at: new Date(2026, 9, 26, 19).toISOString() }),
      task({ id: 'afternoon-low', due_at: new Date(2026, 9, 26, 16).toISOString(), priority: 'low' }),
      task({ id: 'afternoon-high', due_at: new Date(2026, 9, 26, 16).toISOString(), priority: 'high' }),
    ]
    expect(tasksForView(tasks, 'today', now).map((t) => t.id)).toEqual([
      'afternoon-high',
      'afternoon-low',
      'evening',
      'date-only',
    ])
  })

  it('shows the most recently completed first', () => {
    const tasks = [
      task({ id: 'older', status: 'completed', completed_at: '2026-10-20T10:00:00Z' }),
      task({ id: 'newer', status: 'completed', completed_at: '2026-10-25T10:00:00Z' }),
    ]
    expect(tasksForView(tasks, 'completed', now).map((t) => t.id)).toEqual(['newer', 'older'])
  })
})

describe('countByView', () => {
  it('counts each view', () => {
    const counts = countByView(
      [task({ due_date: '2026-10-20' }), task({ due_date: '2026-10-26' }), task(), task({ status: 'completed' })],
      now,
    )
    expect(counts).toEqual({ overdue: 1, today: 1, upcoming: 1, completed: 1 })
  })
})

describe('groupByDueDay', () => {
  it('groups Upcoming by day with undated tasks last', () => {
    const tasks = tasksForView(
      [task({ id: 'a', due_date: '2026-10-27' }), task({ id: 'b' }), task({ id: 'c', due_date: '2026-10-27' })],
      'upcoming',
      now,
    )
    expect(groupByDueDay(tasks, now).map((g) => [g.label, g.tasks.length])).toEqual([
      ['Tomorrow', 2],
      ['No due date', 1],
    ])
  })
})

describe('labels', () => {
  it('names nearby days and dates further out', () => {
    expect(dayLabel(new Date(2026, 9, 26), now)).toBe('Today')
    expect(dayLabel(new Date(2026, 9, 27), now)).toBe('Tomorrow')
    expect(dayLabel(new Date(2026, 9, 25), now)).toBe('Yesterday')
    expect(dayLabel(new Date(2026, 9, 29), now)).toBe('Thursday')
    expect(dayLabel(new Date(2026, 10, 9), now)).toBe('Mon 9 Nov')
    expect(dayLabel(new Date(2027, 0, 4), now)).toBe('Mon 4 Jan 2027')
  })

  it('adds the time for timed tasks', () => {
    expect(dueLabel(task({ due_at: new Date(2026, 9, 27, 15).toISOString() }), now)).toBe('Tomorrow, 3:00 PM')
    expect(dueLabel(task({ due_at: new Date(2026, 9, 27, 15).toISOString() }), now, 'HH:mm')).toBe('Tomorrow, 15:00')
    expect(dueLabel(task(), now)).toBeNull()
  })
})

describe('view helpers', () => {
  it('defaults new tasks to the day the view is about', () => {
    expect(defaultDueDate('today', now)).toBe('2026-10-26')
    expect(defaultDueDate('upcoming', now)).toBe('2026-10-27')
    expect(defaultDueDate('overdue', now)).toBeNull()
  })

  it('reads the view from the URL, defaulting to Today', () => {
    expect(taskViewFromParams(new URLSearchParams('view=overdue'))).toBe('overdue')
    expect(taskViewFromParams(new URLSearchParams('view=nonsense'))).toBe('today')
    expect(taskViewFromParams(new URLSearchParams())).toBe('today')
  })
})

describe('time blocks', () => {
  const block = (start: Date, end: Date) => ({
    id: 'b',
    all_day: false,
    start_at: start.toISOString(),
    end_at: end.toISOString(),
    start_date: null,
    end_date: null,
    rrule: null,
  })

  it('suggests the next full hour, lasting the estimate', () => {
    const timing = suggestBlock({ due_at: null, due_date: null, estimated_minutes: 45 }, now, 60)
    expect(timing.start).toEqual(new Date(2026, 9, 26, 15))
    expect(timing.end).toEqual(new Date(2026, 9, 26, 15, 45))
  })

  it('suggests the due day at 09:00 when the task is due later', () => {
    const timing = suggestBlock({ due_at: null, due_date: '2026-10-29', estimated_minutes: null }, now, 30)
    expect(timing.start).toEqual(new Date(2026, 9, 29, 9))
    expect(timing.end).toEqual(new Date(2026, 9, 29, 9, 30))
  })

  it('suggests tomorrow morning late in the evening', () => {
    const late = new Date(2026, 9, 26, 22, 10)
    const timing = suggestBlock({ due_at: null, due_date: null, estimated_minutes: null }, late, 60)
    expect(timing.start).toEqual(new Date(2026, 9, 27, 9))
  })

  it('lists blocks that have not finished, soonest first', () => {
    const past = block(new Date(2026, 9, 26, 9), new Date(2026, 9, 26, 10))
    const later = { ...block(new Date(2026, 9, 28, 9), new Date(2026, 9, 28, 10)), id: 'later' }
    const soon = { ...block(new Date(2026, 9, 26, 16), new Date(2026, 9, 26, 17)), id: 'soon' }
    expect(upcomingBlocks([past, later, soon], now).map((b) => b.id)).toEqual(['soon', 'later'])
  })

  it('labels a block with its day and times', () => {
    const b = block(new Date(2026, 9, 27, 15), new Date(2026, 9, 27, 16, 30))
    expect(blockLabel(b, now)).toBe('Tomorrow, 3:00 PM – 4:30 PM')
    expect(blockLabel(b, now, 'HH:mm')).toBe('Tomorrow, 15:00 – 16:30')
  })
})
