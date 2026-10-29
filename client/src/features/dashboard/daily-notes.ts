import { supabase } from '../../lib/supabase'

// One row per day in `daily_notes` (README §4.6): the day's intention and a free note.

export type DailyNote = { intention: string; note: string }

export async function fetchDailyNote(date: string): Promise<DailyNote> {
  const { data, error } = await supabase
    .from('daily_notes')
    .select('intention, note')
    .eq('note_date', date)
    .maybeSingle()
  if (error) throw error
  return { intention: data?.intention ?? '', note: data?.note ?? '' }
}

export async function saveDailyNote(userId: string, date: string, value: DailyNote) {
  const { error } = await supabase.from('daily_notes').upsert(
    {
      user_id: userId,
      note_date: date,
      intention: value.intention.trim() || null,
      note: value.note.trim() || null,
    },
    { onConflict: 'user_id,note_date' },
  )
  if (error) throw error
}
