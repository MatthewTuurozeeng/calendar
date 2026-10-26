import { useEffect, useRef, type ReactNode } from 'react'

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
      onClose={onClose}
      aria-labelledby={labelledBy}
      className="m-auto max-h-[calc(100dvh-2rem)] w-[min(32rem,calc(100%-2rem))] overflow-y-auto rounded-2xl border border-line bg-surface p-6 text-ink shadow-xl backdrop:bg-ink/30"
    >
      {children}
    </dialog>
  )
}
