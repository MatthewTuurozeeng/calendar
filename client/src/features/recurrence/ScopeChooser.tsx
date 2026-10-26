import { useId, useState } from 'react'
import { primaryButtonClass, secondaryButtonClass } from '../../components/ui/form'
import type { EditScope } from './scopes'

type ScopeChooserProps = {
  action: 'save' | 'delete'
  /** False when the repeat itself changed, which can't apply to one occurrence. */
  allowThis?: boolean
  pending?: boolean
  onChoose: (scope: EditScope) => void
  onCancel: () => void
}

/** Asks which occurrences of a recurring event a change applies to. */
export function ScopeChooser({ action, allowThis = true, pending, onChoose, onCancel }: ScopeChooserProps) {
  const id = useId()
  const [scope, setScope] = useState<EditScope>(allowThis ? 'this' : 'following')
  const options: { value: EditScope; label: string; disabled?: boolean }[] = [
    { value: 'this', label: 'This event', disabled: !allowThis },
    { value: 'following', label: 'This and following events' },
    { value: 'all', label: 'All events' },
  ]

  return (
    <fieldset className="flex flex-col gap-1">
      <legend className="mb-2 font-semibold">{action === 'save' ? 'Edit recurring event' : 'Delete recurring event'}</legend>
      {options.map((o) => (
        <label
          key={o.value}
          className={`flex min-h-11 items-center gap-3 rounded-xl px-2 ${o.disabled ? 'text-ink-muted' : 'cursor-pointer hover:bg-canvas'}`}
        >
          <input
            type="radio"
            name={id}
            value={o.value}
            checked={scope === o.value}
            disabled={o.disabled}
            onChange={() => setScope(o.value)}
            className="size-5 accent-ink"
          />
          {o.label}
        </label>
      ))}
      {!allowThis && (
        <p className="px-2 text-sm text-ink-muted">A new repeat can only apply to this and following events, or all of them.</p>
      )}
      <div className="mt-3 flex justify-end gap-3">
        <button type="button" onClick={onCancel} className={secondaryButtonClass}>
          Cancel
        </button>
        <button
          type="button"
          disabled={pending}
          onClick={() => onChoose(scope)}
          className={action === 'delete' ? `${secondaryButtonClass} border-dusty-orange` : primaryButtonClass}
        >
          {pending ? 'Saving…' : action === 'delete' ? 'Delete' : 'Save'}
        </button>
      </div>
    </fieldset>
  )
}
