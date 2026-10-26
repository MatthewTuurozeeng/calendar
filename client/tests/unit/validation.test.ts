import { describe, expect, it } from 'vitest'
import { validateEvent, validateTask } from '../../src/lib/validation'

const start = new Date(2026, 9, 26, 9)
const end = new Date(2026, 9, 26, 10)

describe('validateEvent', () => {
  it('accepts a titled event that ends after it starts', () => {
    expect(validateEvent({ title: 'Lecture', start, end })).toEqual({})
  })

  it('requires a non-blank title', () => {
    expect(validateEvent({ title: '   ', start, end }).title).toBeDefined()
  })

  it('rejects an end at or before the start', () => {
    expect(validateEvent({ title: 'x', start, end: start }).end).toBe('End must be after the start.')
  })

  it('reports unparseable dates', () => {
    const errors = validateEvent({ title: 'x', start: new Date(NaN), end })
    expect(errors.start).toBeDefined()
  })
})

describe('validateTask', () => {
  const valid = { title: 'Write report', due: null, estimatedMinutes: '' }

  it('accepts a task with only a title', () => {
    expect(validateTask(valid)).toEqual({})
  })

  it('requires a title', () => {
    expect(validateTask({ ...valid, title: '  ' }).title).toBeDefined()
  })

  it('rejects an invalid due date', () => {
    expect(validateTask({ ...valid, due: new Date('nope') }).due).toBeDefined()
  })

  it('needs a positive whole-number estimate', () => {
    expect(validateTask({ ...valid, estimatedMinutes: '30' })).toEqual({})
    expect(validateTask({ ...valid, estimatedMinutes: '0' }).estimate).toBeDefined()
    expect(validateTask({ ...valid, estimatedMinutes: '1.5' }).estimate).toBeDefined()
    expect(validateTask({ ...valid, estimatedMinutes: 'soon' }).estimate).toBeDefined()
  })
})
