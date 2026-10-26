import type { ReactNode } from 'react'

export function FullPageStatus({ children }: { children: ReactNode }) {
  return (
    <div className="grid min-h-dvh place-items-center px-4">
      <div className="max-w-sm text-center text-ink-muted">{children}</div>
    </div>
  )
}
