import { useState, type FormEvent } from 'react'
import { errorClass, inputClass, labelClass, primaryButtonClass, secondaryButtonClass } from '../../components/ui/form'
import { supabase } from '../../lib/supabase'
import { useSession } from '../auth/auth-context'
import type { TrackSave } from './save-status'

const MIN_PASSWORD_LENGTH = 8

export function AccountSettings({ track }: { track: TrackSave }) {
  const session = useSession()
  const [changingPassword, setChangingPassword] = useState(false)

  return (
    <>
      <div className="flex flex-col gap-1 py-4 sm:flex-row sm:items-center sm:justify-between sm:gap-6">
        <p className="font-medium">Email</p>
        <p className="break-all text-ink-muted">{session.user.email}</p>
      </div>

      <div className="py-4">
        {changingPassword ? (
          <PasswordForm track={track} onDone={() => setChangingPassword(false)} />
        ) : (
          <div className="flex items-center justify-between gap-6">
            <p className="font-medium">Password</p>
            <button type="button" className={secondaryButtonClass} onClick={() => setChangingPassword(true)}>
              Change
            </button>
          </div>
        )}
      </div>

      <div className="flex items-center justify-between gap-6 py-4">
        <div>
          <p className="font-medium">Sign out</p>
          <p className="mt-0.5 text-sm text-ink-muted">Your data stays in your account.</p>
        </div>
        <button type="button" className={secondaryButtonClass} onClick={() => void supabase.auth.signOut()}>
          Sign out
        </button>
      </div>
    </>
  )
}

function PasswordForm({ track, onDone }: { track: TrackSave; onDone: () => void }) {
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (password.length < MIN_PASSWORD_LENGTH) return setError(`Use at least ${MIN_PASSWORD_LENGTH} characters.`)
    if (password !== confirm) return setError("The passwords don't match.")
    setError(null)
    setPending(true)
    const ok = await track(async () => {
      const { error } = await supabase.auth.updateUser({ password })
      if (error) throw error
    })
    setPending(false)
    if (ok) onDone()
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-4">
      <p className="font-medium">Change password</p>
      <div>
        <label htmlFor="new-password" className={labelClass}>
          New password
        </label>
        <input
          id="new-password"
          type="password"
          className={inputClass}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete="new-password"
          aria-invalid={!!error}
          autoFocus
        />
        <p className="mt-1 text-xs text-ink-muted">At least {MIN_PASSWORD_LENGTH} characters.</p>
      </div>
      <div>
        <label htmlFor="confirm-password" className={labelClass}>
          Confirm new password
        </label>
        <input
          id="confirm-password"
          type="password"
          className={inputClass}
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          autoComplete="new-password"
          aria-invalid={!!error}
          aria-describedby={error ? 'password-error' : undefined}
        />
        {error && (
          <p id="password-error" role="alert" className={errorClass}>
            {error}
          </p>
        )}
      </div>
      <div className="flex justify-end gap-3">
        <button type="button" onClick={onDone} className={secondaryButtonClass}>
          Cancel
        </button>
        <button type="submit" disabled={pending} className={primaryButtonClass}>
          {pending ? 'Saving…' : 'Update password'}
        </button>
      </div>
    </form>
  )
}
