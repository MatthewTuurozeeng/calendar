import { CheckIcon } from '../../components/ui/icons'
import type { SaveStatus } from './save-status'

export function SaveToast({ status, onDismiss }: { status: SaveStatus; onDismiss: () => void }) {
  return (
    <div
      aria-live="polite"
      className="pointer-events-none fixed inset-x-0 bottom-[calc(5.5rem+env(safe-area-inset-bottom))] z-20 flex justify-center px-4 md:bottom-6"
    >
      {status && (
        <div
          role={status.kind === 'error' ? 'alert' : 'status'}
          className={`pointer-events-auto flex min-h-11 max-w-md items-center gap-3 rounded-xl px-4 text-sm font-medium shadow-lg shadow-ink/15 ${
            status.kind === 'error' ? 'bg-warm-peach text-ink' : 'bg-ink text-surface'
          }`}
        >
          {status.kind === 'saving' && 'Saving…'}
          {status.kind === 'saved' && (
            <>
              <CheckIcon className="size-4" />
              Saved
            </>
          )}
          {status.kind === 'error' && (
            <>
              <span>{status.message}</span>
              <button type="button" onClick={onDismiss} className="underline underline-offset-4">
                Dismiss
              </button>
            </>
          )}
        </div>
      )}
    </div>
  )
}
