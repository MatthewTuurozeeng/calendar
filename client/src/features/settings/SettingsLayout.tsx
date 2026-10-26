import type { ReactNode } from 'react'

type SettingsSectionProps = {
  id: string
  title: string
  description?: string
  children: ReactNode
}

export function SettingsSection({ id, title, description, children }: SettingsSectionProps) {
  return (
    <section id={id} aria-labelledby={`${id}-heading`} className="scroll-mt-24 rounded-2xl border border-line bg-surface">
      <header className="border-b border-line px-5 py-4">
        <h2 id={`${id}-heading`} className="text-base font-semibold">
          {title}
        </h2>
        {description && <p className="mt-0.5 text-sm text-ink-muted">{description}</p>}
      </header>
      <div className="divide-y divide-line px-5">{children}</div>
    </section>
  )
}

type SettingRowProps = {
  /** The control's id, so the label points at it. Groups use aria-labelledby={`${id}-label`}. */
  id: string
  label: string
  description?: ReactNode
  /** Keep the control beside the label on phones too, as for switches. */
  inline?: boolean
  children: ReactNode
}

/** Label and description on the left, control on the right. */
export function SettingRow({ id, label, description, inline, children }: SettingRowProps) {
  return (
    <div
      className={`flex gap-3 py-4 ${
        inline ? 'items-center justify-between' : 'flex-col sm:flex-row sm:items-center sm:justify-between sm:gap-6'
      }`}
    >
      <div className="min-w-0">
        <label id={`${id}-label`} htmlFor={id} className="font-medium">
          {label}
        </label>
        {description && (
          <p id={`${id}-description`} className="mt-0.5 text-sm text-ink-muted">
            {description}
          </p>
        )}
      </div>
      <div className={inline ? 'shrink-0' : 'w-full shrink-0 sm:w-64'}>{children}</div>
    </div>
  )
}
