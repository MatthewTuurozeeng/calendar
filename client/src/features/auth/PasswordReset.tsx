import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router'
import { FullPageStatus } from '../../components/ui/FullPageStatus'
import { errorClass, inputClass, labelClass, primaryButtonClass } from '../../components/ui/form'
import { LogoMark } from '../../components/ui/Logo'
import { supabase } from '../../lib/supabase'
import { useAuth } from './auth-context'

// "Forgot password?" (README §4.10). Supabase emails a link to /reset-password;
// opening it signs the user in for recovery, and the page there sets the new password.

const MIN_PASSWORD_LENGTH = 8

/** Shown inside the sign-in card in place of the sign-in form. */
export function ForgotPasswordForm({ initialEmail, onBack }: { initialEmail: string; onBack: () => void }) {
  const [email, setEmail] = useState(initialEmail)
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)
  const [sentTo, setSentTo] = useState<string | null>(null)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setPending(true)
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    })
    setPending(false)
    if (error) setError(error.message)
    else setSentTo(email)
  }

  if (sentTo) {
    return (
      <div role="status">
        <h2 className="text-lg font-semibold">Check your email</h2>
        <p className="mt-2 text-sm text-ink-muted">
          If <span className="font-medium text-ink">{sentTo}</span> has an account, we sent it a link to choose a new
          password. It can take a minute to arrive, so check spam too.
        </p>
        <button type="button" className="mt-6 text-sm font-medium underline underline-offset-4" onClick={onBack}>
          Back to sign in
        </button>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <div>
        <h2 className="text-lg font-semibold">Reset your password</h2>
        <p className="mt-1 text-sm text-ink-muted">Enter your email and we'll send you a link to choose a new one.</p>
      </div>
      <div>
        <label htmlFor="reset-email" className={labelClass}>
          Email
        </label>
        <input
          id="reset-email"
          type="email"
          required
          autoFocus
          className={inputClass}
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          autoComplete="email"
        />
      </div>
      {error && (
        <p role="alert" className={errorClass}>
          {error}
        </p>
      )}
      <button type="submit" disabled={pending} className={primaryButtonClass}>
        {pending ? 'Sending…' : 'Send reset link'}
      </button>
      <button type="button" className="text-sm font-medium text-ink-muted hover:text-ink" onClick={onBack}>
        Back to sign in
      </button>
    </form>
  )
}

/** The page the reset email links to. */
export function ResetPasswordPage() {
  const { session, loading } = useAuth()
  const navigate = useNavigate()
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)

  if (loading) return <FullPageStatus>Checking your link…</FullPageStatus>

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (password.length < MIN_PASSWORD_LENGTH) return setError(`Use at least ${MIN_PASSWORD_LENGTH} characters.`)
    if (password !== confirm) return setError("The passwords don't match.")
    setError(null)
    setPending(true)
    const { error } = await supabase.auth.updateUser({ password })
    setPending(false)
    if (error) setError(error.message)
    else navigate('/', { replace: true })
  }

  return (
    <main className="grid min-h-dvh place-items-center px-4 py-16">
      <div className="w-full max-w-sm">
        <Link to="/welcome" className="mx-auto flex w-fit items-center gap-2.5 text-2xl font-semibold">
          <LogoMark />
          <span>Calendar</span>
        </Link>
        <div className="mt-8 rounded-2xl border border-line bg-surface p-6">
          {!session ? (
            <div role="alert">
              <h1 className="text-lg font-semibold">This link has expired</h1>
              <p className="mt-2 text-sm text-ink-muted">
                Reset links work once and only for a short time. Ask for a new one from the sign-in page.
              </p>
              <Link to="/sign-in" className={`${primaryButtonClass} mt-6 w-full`}>
                Back to sign in
              </Link>
            </div>
          ) : (
            <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-4">
              <div>
                <h1 className="text-lg font-semibold">Choose a new password</h1>
                <p className="mt-1 text-sm break-all text-ink-muted">For {session.user.email}</p>
              </div>
              <div>
                <label htmlFor="new-password" className={labelClass}>
                  New password
                </label>
                <input
                  id="new-password"
                  type="password"
                  autoFocus
                  className={inputClass}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="new-password"
                />
                <p className="mt-1 text-xs text-ink-muted">At least {MIN_PASSWORD_LENGTH} characters.</p>
              </div>
              <div>
                <label htmlFor="confirm-new-password" className={labelClass}>
                  Confirm new password
                </label>
                <input
                  id="confirm-new-password"
                  type="password"
                  className={inputClass}
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  autoComplete="new-password"
                  aria-describedby={error ? 'reset-error' : undefined}
                />
              </div>
              {error && (
                <p id="reset-error" role="alert" className={errorClass}>
                  {error}
                </p>
              )}
              <button type="submit" disabled={pending} className={primaryButtonClass}>
                {pending ? 'Saving…' : 'Save and continue'}
              </button>
            </form>
          )}
        </div>
      </div>
    </main>
  )
}
