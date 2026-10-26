import { isValid } from 'date-fns'

export type FieldErrors<K extends string> = Partial<Record<K, string>>

export const TITLE_MAX_LENGTH = 200

export function validateEvent(input: {
  title: string
  start: Date
  end: Date
}): FieldErrors<'title' | 'start' | 'end'> {
  const errors: FieldErrors<'title' | 'start' | 'end'> = {}
  const title = input.title.trim()

  if (!title) errors.title = 'Give the event a title.'
  else if (title.length > TITLE_MAX_LENGTH) errors.title = `Keep the title under ${TITLE_MAX_LENGTH} characters.`

  if (!isValid(input.start)) errors.start = 'Enter a valid start.'
  if (!isValid(input.end)) errors.end = 'Enter a valid end.'
  else if (isValid(input.start) && input.end <= input.start) errors.end = 'End must be after the start.'

  return errors
}

export function validateTask(input: {
  title: string
  due: Date | null
  estimatedMinutes: string
}): FieldErrors<'title' | 'due' | 'estimate'> {
  const errors: FieldErrors<'title' | 'due' | 'estimate'> = {}
  const title = input.title.trim()

  if (!title) errors.title = 'Give the task a title.'
  else if (title.length > TITLE_MAX_LENGTH) errors.title = `Keep the title under ${TITLE_MAX_LENGTH} characters.`

  if (input.due && !isValid(input.due)) errors.due = 'Enter a valid due date.'

  const estimate = input.estimatedMinutes.trim()
  if (estimate && !(/^\d+$/.test(estimate) && Number(estimate) > 0)) {
    errors.estimate = 'Enter a whole number of minutes.'
  }

  return errors
}
