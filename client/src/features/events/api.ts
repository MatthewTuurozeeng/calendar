import { supabase } from '../../lib/supabase'
import { toDateString } from '../../lib/dates'
import type { Tables, TablesInsert, TablesUpdate } from '../../types/database'

export type EventRow = Tables<'events'>

/** Fires 'change' after any event write, so open views can refetch. */
export const eventChanges = new EventTarget()

function notifyChange() {
  eventChanges.dispatchEvent(new Event('change'))
}

/** Events overlapping [start, end). Recurring series are expanded in a later step. */
export async function fetchEventsInRange(start: Date, end: Date): Promise<EventRow[]> {
  const timed = `and(all_day.is.false,start_at.lt.${end.toISOString()},end_at.gt.${start.toISOString()})`
  const allDay = `and(all_day.is.true,start_date.lt.${toDateString(end)},end_date.gt.${toDateString(start)})`

  const { data, error } = await supabase
    .from('events')
    .select('*')
    .or(`${timed},${allDay}`)
    .order('start_at', { ascending: true, nullsFirst: true })
  if (error) throw error
  return data
}

export async function createEvent(values: TablesInsert<'events'>) {
  const { error } = await supabase.from('events').insert(values)
  if (error) throw error
  notifyChange()
}

export async function updateEvent(id: string, values: TablesUpdate<'events'>) {
  const { error } = await supabase.from('events').update(values).eq('id', id)
  if (error) throw error
  notifyChange()
}

export async function deleteEvent(id: string) {
  const { error } = await supabase.from('events').delete().eq('id', id)
  if (error) throw error
  notifyChange()
}
