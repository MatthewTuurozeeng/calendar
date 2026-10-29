import { useEffect, useRef, useState } from 'react'
import { inputClass } from '../../components/ui/form'
import { useAuth } from '../auth/auth-context'
import { fetchDailyNote, saveDailyNote, type DailyNote } from './daily-notes'

const SAVE_DELAY_MS = 800

type Status = 'loading' | 'idle' | 'saving' | 'saved' | 'error'

/** The day's intention and note. Keyed by date by the caller, so it reloads at midnight. */
export function DailyIntention({ date }: { date: string }) {
  const { session } = useAuth()
  const userId = session!.user.id
  const [value, setValue] = useState<DailyNote>({ intention: '', note: '' })
  const [status, setStatus] = useState<Status>('loading')
  const [loadError, setLoadError] = useState<string | null>(null)
  const [showNote, setShowNote] = useState(false)
  const timer = useRef<number | undefined>(undefined)
  // What's in the database, so unchanged values aren't saved again.
  const saved = useRef<DailyNote>({ intention: '', note: '' })
  const latest = useRef(value)

  useEffect(() => {
    let cancelled = false
    fetchDailyNote(date).then(
      (note) => {
        if (cancelled) return
        saved.current = note
        latest.current = note
        setValue(note)
        setShowNote(note.note !== '')
        setStatus('idle')
      },
      (err: unknown) => {
        if (cancelled) return
        setLoadError(err instanceof Error ? err.message : 'Could not load your note.')
        setStatus('error')
      },
    )
    return () => {
      cancelled = true
    }
  }, [date])

  async function flush() {
    window.clearTimeout(timer.current)
    const next = latest.current
    if (next.intention.trim() === saved.current.intention.trim() && next.note.trim() === saved.current.note.trim()) {
      return
    }
    setStatus('saving')
    try {
      await saveDailyNote(userId, date, next)
      saved.current = next
      setStatus('saved')
    } catch {
      setStatus('error')
    }
  }

  // Save anything pending when leaving the page.
  useEffect(() => () => void flush(), []) // eslint-disable-line react-hooks/exhaustive-deps

  function change(patch: Partial<DailyNote>) {
    const next = { ...latest.current, ...patch }
    latest.current = next
    setValue(next)
    window.clearTimeout(timer.current)
    timer.current = window.setTimeout(() => void flush(), SAVE_DELAY_MS)
  }

  if (loadError) {
    return (
      <section aria-labelledby="intention" className="rounded-2xl border border-line bg-surface p-5">
        <h2 id="intention" className="text-xs font-semibold tracking-wide text-ink-muted uppercase">
          Today's intention
        </h2>
        <p role="alert" className="mt-2 text-sm text-ink-muted">
          {loadError}
        </p>
      </section>
    )
  }

  return (
    <section
      aria-labelledby="intention"
      className="rounded-2xl border border-line bg-gradient-to-br from-warm-peach/20 to-surface p-5"
    >
      <div className="flex items-center justify-between gap-4">
        <h2 id="intention" className="text-xs font-semibold tracking-wide text-ink-muted uppercase">
          Today's intention
        </h2>
        <span className="text-xs text-ink-muted" role="status">
          {status === 'saving' ? 'Saving…' : status === 'saved' ? 'Saved' : status === 'error' ? "Couldn't save" : ''}
        </span>
      </div>
      <input
        aria-labelledby="intention"
        // Reads as plain text until focused; the negative margin lines it up with the heading.
        className="-mx-3 mt-1 block min-h-11 w-[calc(100%+1.5rem)] rounded-xl border border-transparent bg-transparent px-3 text-lg font-medium placeholder:font-normal placeholder:text-ink-muted/70 hover:border-line focus:border-line focus:bg-surface"
        placeholder={status === 'loading' ? 'Loading…' : 'What would make today a good day?'}
        disabled={status === 'loading'}
        maxLength={200}
        value={value.intention}
        onChange={(e) => change({ intention: e.target.value })}
        onBlur={() => void flush()}
      />
      {showNote ? (
        <textarea
          aria-label="Note for today"
          className={`${inputClass} mt-3 min-h-24 py-2`}
          placeholder="Anything else on your mind…"
          value={value.note}
          onChange={(e) => change({ note: e.target.value })}
          onBlur={() => void flush()}
        />
      ) : (
        status !== 'loading' && (
          <button
            type="button"
            className="mt-2 text-sm font-medium text-ink-muted underline-offset-4 hover:text-ink hover:underline"
            onClick={() => setShowNote(true)}
          >
            Add a note
          </button>
        )
      )}
    </section>
  )
}
