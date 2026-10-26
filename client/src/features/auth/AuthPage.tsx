import { useState, type FormEvent } from 'react'
import { Navigate, useLocation } from 'react-router'
import { errorClass, inputClass, labelClass, primaryButtonClass } from '../../components/ui/form'
import { browserTimeZone } from '../../lib/dates'
import { supabase } from '../../lib/supabase'
import { useAuth } from './auth-context'

type Mode = 'sign-in' | 'sign-up'

export function AuthPage() {
  const { session } = useAuth()
  const location = useLocation()
  const [mode, setMode] = useState<Mode>('sign-in')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
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

  function switchMode(next: Mode) {
    setMode(next)
    setError(null)
  }

  return (
    <main className="grid min-h-dvh place-items-center px-4 py-10">
      <div className="w-full max-w-sm">
        <h1 className="text-center text-2xl font-semibold">Calendar</h1>

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
