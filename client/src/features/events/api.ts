import { supabase } from '../../lib/supabase'
import type { Tables, TablesInsert, TablesUpdate } from '../../types/database'

export type EventRow = Tables<'events'>

/** Fires 'change' after any event write, so open views can refetch. */
export const eventChanges = new EventTarget()

export function notifyChange() {
  eventChanges.dispatchEvent(new Event('change'))
}

export async function createEvent(values: TablesInsert<'events'>): Promise<EventRow> {
  const { data, error } = await supabase.from('events').insert(values).select().single()
  if (error) throw error
  notifyChange()
  return data
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
