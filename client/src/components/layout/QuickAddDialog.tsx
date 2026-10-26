import { useEffect, useRef } from 'react'

type QuickAddDialogProps = {
  open: boolean
  onClose: () => void
}

export function QuickAddDialog({ open, onClose }: QuickAddDialogProps) {
  const ref = useRef<HTMLDialogElement>(null)

  useEffect(() => {
    const dialog = ref.current
    if (!dialog) return
    if (open && !dialog.open) dialog.showModal()
    if (!open && dialog.open) dialog.close()
  }, [open])

  return (
    <dialog
      ref={ref}
      onClose={onClose}
      aria-labelledby="quick-add-title"
      className="m-auto w-[min(28rem,calc(100%-2rem))] rounded-2xl border border-line bg-surface p-6 text-ink shadow-xl backdrop:bg-ink/30"
    >
      <h2 id="quick-add-title" className="text-lg font-semibold">
        Quick add
      </h2>
      <p className="mt-2 text-sm text-ink-muted">
        Adding events and tasks isn't wired up yet.
      </p>
      <div className="mt-6 flex justify-end">
        <button
          type="button"
          onClick={onClose}
          className="min-h-11 rounded-xl border border-line px-4 font-medium hover:bg-canvas"
        >
          Close
        </button>
      </div>
    </dialog>
  )
}
