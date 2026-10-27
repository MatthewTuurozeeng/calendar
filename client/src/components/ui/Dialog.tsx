import { useEffect, useRef, type ReactNode } from 'react'
import { XIcon } from './icons'

type DialogProps = {
  labelledBy: string
  onClose: () => void
  children: ReactNode
}

/** A modal that opens when mounted; the parent unmounts it from `onClose`. */
export function Dialog({ labelledBy, onClose, children }: DialogProps) {
  const ref = useRef<HTMLDialogElement>(null)

  useEffect(() => {
    const dialog = ref.current
    if (dialog && !dialog.open) dialog.showModal()
  }, [])

  return (
    <dialog
      ref={ref}
      // React bubbles a nested dialog's close event up to this one; ignore it.
      onClose={(e) => e.target === e.currentTarget && onClose()}
      aria-labelledby={labelledBy}
      className="m-auto max-h-[calc(100dvh-2rem)] w-[min(32rem,calc(100%-2rem))] overflow-y-auto rounded-2xl border border-line bg-surface p-6 text-ink shadow-xl backdrop:bg-ink/30"
    >
      {children}
      {/* After the content so opening the dialog still focuses its first field; shown top-right. */}
      <button
        type="button"
        onClick={() => ref.current?.close()}
        aria-label="Close"
        title="Close"
        className="absolute top-3 right-3 grid size-11 place-items-center rounded-xl text-ink-muted hover:bg-canvas hover:text-ink"
      >
        <XIcon className="size-5" />
      </button>
    </dialog>
  )
}
