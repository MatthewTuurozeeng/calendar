import { useEffect, useState, type ReactNode } from 'react'
import { Navigate, useLocation } from 'react-router'
import { FullPageStatus } from '../../components/ui/FullPageStatus'
import { secondaryButtonClass } from '../../components/ui/form'
import { supabase } from '../../lib/supabase'
import { useAuth } from './auth-context'
import { UserDataContext, type UserData } from './user-data'

type LoadState = { status: 'loading' } | { status: 'error'; message: string } | ({ status: 'ready' } & UserData)

export function RequireAuth({ children }: { children: ReactNode }) {
  const { session, loading } = useAuth()
  const location = useLocation()

  if (loading) return <FullPageStatus>Loading…</FullPageStatus>
  if (!session) return <Navigate to="/sign-in" replace state={{ from: location.pathname }} />

  return <UserDataLoader userId={session.user.id}>{children}</UserDataLoader>
}

async function loadUserData(userId: string): Promise<LoadState> {
  const [profile, categories] = await Promise.all([
    supabase.from('profiles').select('*').eq('id', userId).maybeSingle(),
    supabase.from('categories').select('*').is('archived_at', null).order('position'),
  ])

  const error = profile.error ?? categories.error
  if (error) return { status: 'error', message: error.message }
  // The handle_new_user trigger should have created this row at sign-up.
  if (!profile.data) return { status: 'error', message: "Your profile wasn't created when you signed up." }
  return { status: 'ready', profile: profile.data, categories: categories.data ?? [] }
}

function UserDataLoader({ userId, children }: { userId: string; children: ReactNode }) {
  const [state, setState] = useState<LoadState>({ status: 'loading' })
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    let cancelled = false
    void loadUserData(userId).then((next) => {
      if (!cancelled) setState(next)
    })
    return () => {
      cancelled = true
    }
  }, [userId, attempt])

  const retry = () => {
    setState({ status: 'loading' })
    setAttempt((n) => n + 1)
  }

  if (state.status === 'loading') return <FullPageStatus>Loading your calendar…</FullPageStatus>

  if (state.status === 'error') {
    return (
      <FullPageStatus>
        <p className="font-medium text-ink">Couldn't load your account</p>
        <p className="mt-2 text-sm">{state.message}</p>
        <div className="mt-6 flex justify-center gap-3">
          <button type="button" className={secondaryButtonClass} onClick={retry}>
            Try again
          </button>
          <button type="button" className={secondaryButtonClass} onClick={() => void supabase.auth.signOut()}>
            Sign out
          </button>
        </div>
      </FullPageStatus>
    )
  }

  return (
    <UserDataContext.Provider value={{ profile: state.profile, categories: state.categories }}>
      {children}
    </UserDataContext.Provider>
  )
}
