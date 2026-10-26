import { useCallback, useEffect, useRef, useState } from 'react'

export type SaveStatus = { kind: 'saving' } | { kind: 'saved' } | { kind: 'error'; message: string } | null

/** Settings save as they change; this tracks each save for the status toast. */
export function useSaveStatus() {
  const [status, setStatus] = useState<SaveStatus>(null)
  const pending = useRef(0)
  const hideTimer = useRef<number | undefined>(undefined)

  useEffect(() => () => window.clearTimeout(hideTimer.current), [])

  /** Runs the save and reports it; resolves to whether it succeeded. */
  const track = useCallback(async (save: () => Promise<unknown>): Promise<boolean> => {
    window.clearTimeout(hideTimer.current)
    pending.current += 1
    setStatus({ kind: 'saving' })
    try {
      await save()
      pending.current -= 1
      if (pending.current === 0) {
        setStatus({ kind: 'saved' })
        hideTimer.current = window.setTimeout(() => setStatus(null), 2000)
      }
      return true
    } catch (err) {
      pending.current -= 1
      setStatus({ kind: 'error', message: err instanceof Error ? err.message : 'Could not save your change.' })
      return false
    }
  }, [])

  const dismiss = useCallback(() => setStatus(null), [])

  return { status, track, dismiss }
}

export type TrackSave = ReturnType<typeof useSaveStatus>['track']
