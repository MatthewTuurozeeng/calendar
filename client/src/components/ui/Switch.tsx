type SwitchProps = {
  id?: string
  checked: boolean
  onChange: (checked: boolean) => void
  disabled?: boolean
  'aria-describedby'?: string
}

/** An on/off toggle. Label it with <label htmlFor={id}>. */
export function Switch({ id, checked, onChange, disabled, ...aria }: SwitchProps) {
  return (
    <button
      id={id}
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className="group grid min-h-11 shrink-0 place-items-center disabled:opacity-60"
      {...aria}
    >
      <span
        className={`flex h-7 w-12 items-center rounded-full p-0.5 transition-colors ${
          checked ? 'bg-accent' : 'bg-line'
        }`}
      >
        <span
          className={`size-6 rounded-full bg-surface shadow-sm ring-1 ring-ink/10 transition-transform ${
            checked ? 'translate-x-5' : ''
          }`}
        />
      </span>
    </button>
  )
}
