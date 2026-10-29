import { useState, type FormEvent } from 'react'
import { Link, Navigate, useLocation, useSearchParams } from 'react-router'
import { errorClass, inputClass, labelClass, primaryButtonClass } from '../../components/ui/form'
import { ArrowRightIcon } from '../../components/ui/icons'
import { LogoMark } from '../../components/ui/Logo'
import { browserTimeZone } from '../../lib/dates'
import { supabase } from '../../lib/supabase'
import { useAuth } from './auth-context'

type Mode = 'sign-in' | 'sign-up'

export function AuthPage() {
  const { session } = useAuth()
  const location = useLocation()
  const [searchParams] = useSearchParams()
  // The landing page's "Get started" links here with ?mode=sign-up.
  const [mode, setMode] = useState<Mode>(searchParams.get('mode') === 'sign-up' ? 'sign-up' : 'sign-in')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)
  const [confirmationSentTo, setConfirmationSentTo] = useState<string | null>(null)

  if (session) {
    const from = (location.state as { from?: string } | null)?.from ?? '/'
    return <Navigate to={from} replace />
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    if (mismatch) {
      // The message is already shown under the field.
      document.getElementById('confirm-password')?.focus()
      return
    }
    setPending(true)

    if (mode === 'sign-in') {
      const { error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) setError(error.message)
    } else {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          // Read by the handle_new_user trigger to create the profile.
          data: { timezone: browserTimeZone(), display_name: displayName.trim() || null },
          emailRedirectTo: window.location.origin,
        },
      })
      if (error) setError(error.message)
      else if (!data.session) setConfirmationSentTo(email)
    }

    setPending(false)
  }

  // Shown once they've started typing the confirmation.
  const mismatch = mode === 'sign-up' && confirmPassword !== '' && confirmPassword !== password

  function switchMode(next: Mode) {
    setMode(next)
    setError(null)
    setConfirmPassword('')
  }

  return (
    <main className="relative grid min-h-dvh place-items-center px-4 py-16">
      <Link
        to="/welcome"
        className="absolute top-4 left-4 inline-flex min-h-11 items-center gap-1.5 rounded-xl px-3 text-sm font-medium text-ink-muted hover:bg-surface hover:text-ink sm:top-6 sm:left-6"
      >
        <ArrowRightIcon className="size-4 rotate-180" />
        Back to home
      </Link>
      <div className="w-full max-w-sm">
        <Link to="/welcome" className="mx-auto flex w-fit items-center gap-2.5 text-2xl font-semibold">
          <LogoMark />
          <h1>Calendar</h1>
        </Link>

        <div className="mt-8 rounded-2xl border border-line bg-surface p-6">
          {confirmationSentTo ? (
            <div role="status">
              <h2 className="text-lg font-semibold">Check your email</h2>
              <p className="mt-2 text-sm text-ink-muted">
                We sent a confirmation link to <span className="font-medium text-ink">{confirmationSentTo}</span>.
                Open it on this device to finish signing up.
              </p>
              <button
                type="button"
                className="mt-6 text-sm font-medium underline underline-offset-4"
                onClick={() => {
                  setConfirmationSentTo(null)
                  switchMode('sign-in')
                }}
              >
                Back to sign in
              </button>
            </div>
          ) : (
            <>
              <div role="tablist" aria-label="Account" className="grid grid-cols-2 rounded-xl bg-canvas p-1">
                {(['sign-in', 'sign-up'] as const).map((m) => (
                  <button
                    key={m}
                    type="button"
                    role="tab"
                    aria-selected={mode === m}
                    onClick={() => switchMode(m)}
                    className={`min-h-10 rounded-lg text-sm font-medium ${
                      mode === m ? 'bg-surface shadow-sm' : 'text-ink-muted'
                    }`}
                  >
                    {m === 'sign-in' ? 'Sign in' : 'Create account'}
                  </button>
                ))}
              </div>

              <form onSubmit={handleSubmit} className="mt-6 flex flex-col gap-4">
                {mode === 'sign-up' && (
                  <div>
                    <label htmlFor="display-name" className={labelClass}>
                      Name <span className="font-normal text-ink-muted">(optional)</span>
                    </label>
                    <input
                      id="display-name"
                      className={inputClass}
                      value={displayName}
                      onChange={(e) => setDisplayName(e.target.value)}
                      autoComplete="name"
                    />
                  </div>
                )}
                <div>
                  <label htmlFor="email" className={labelClass}>
                    Email
                  </label>
                  <input
                    id="email"
                    type="email"
                    required
                    className={inputClass}
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    autoComplete="email"
                  />
                </div>
                <div>
                  <label htmlFor="password" className={labelClass}>
                    Password
                  </label>
                  <input
                    id="password"
                    type="password"
                    required
                    minLength={mode === 'sign-up' ? 8 : undefined}
                    className={inputClass}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    autoComplete={mode === 'sign-in' ? 'current-password' : 'new-password'}
                  />
                  {mode === 'sign-up' && <p className="mt-1 text-xs text-ink-muted">At least 8 characters.</p>}
                </div>
                {mode === 'sign-up' && (
                  <div>
                    <label htmlFor="confirm-password" className={labelClass}>
                      Confirm password
                    </label>
                    <input
                      id="confirm-password"
                      type="password"
                      required
                      className={inputClass}
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      autoComplete="new-password"
                      aria-invalid={mismatch}
                      aria-describedby={mismatch ? 'confirm-password-hint' : undefined}
                    />
                    {mismatch && (
                      <p id="confirm-password-hint" className={errorClass}>
                        The passwords don't match.
                      </p>
                    )}
                  </div>
                )}

                {error && (
                  <p role="alert" className={errorClass}>
                    {error}
                  </p>
                )}

                <button type="submit" disabled={pending} className={primaryButtonClass}>
                  {pending ? 'Please wait…' : mode === 'sign-in' ? 'Sign in' : 'Create account'}
                </button>
              </form>
            </>
          )}
        </div>
      </div>
    </main>
  )
}
