import { supabase } from '../../lib/supabase'
import type { TablesInsert, TablesUpdate } from '../../types/database'
import type { Category } from '../auth/user-data'

/** The Sunset Cloud palette (README §5) plus a few pastels that keep ink text readable. */
export const CATEGORY_COLORS = [
  { hex: '#F08D7E', name: 'Dusty orange' },
  { hex: '#EFA18A', name: 'Warm peach' },
  { hex: '#E2BAB1', name: 'Soft rose' },
  { hex: '#DDA6B9', name: 'Rose pink' },
  { hex: '#ACAEC5', name: 'Periwinkle' },
  { hex: '#A9C4D6', name: 'Mist blue' },
  { hex: '#B7C9B0', name: 'Sage' },
  { hex: '#E8D3A9', name: 'Sand' },
]

/** Turns database errors into messages a person can act on. */
function friendly(error: { code?: string; message: string }, name?: string): Error {
  if (error.code === '23505') return new Error(`You already have a category called "${name}".`)
  return new Error(error.message)
}

export async function createCategory(values: TablesInsert<'categories'>) {
  const { error } = await supabase.from('categories').insert(values)
  if (error) throw friendly(error, values.name)
}

export async function updateCategory(id: string, values: TablesUpdate<'categories'>) {
  const { error } = await supabase.from('categories').update(values).eq('id', id)
  if (error) throw friendly(error, values.name)
}

/** Events and tasks in the category keep existing, without a category. */
export async function deleteCategory(id: string) {
  const { error } = await supabase.from('categories').delete().eq('id', id)
  if (error) throw friendly(error)
}

/** Writes positions 0..n-1 in the given order, skipping rows already in place. */
export async function reorderCategories(ordered: Category[]) {
  const changed = ordered.flatMap((c, position) => (c.position === position ? [] : [{ id: c.id, position }]))
  await Promise.all(changed.map(({ id, position }) => updateCategory(id, { position })))
}
