import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import { Navigate, useLocation } from 'react-router'
import { FullPageStatus } from '../../components/ui/FullPageStatus'
import { secondaryButtonClass } from '../../components/ui/form'
import { supabase } from '../../lib/supabase'
import type { TablesUpdate } from '../../types/database'
import { isInstalled } from '../pwa/install'
import { useAuth } from './auth-context'
import { UserDataContext, type Category, type Profile, type UserData } from './user-data'

type LoadState =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'ready'; profile: Profile; allCategories: Category[] }

export function RequireAuth({ children }: { children: ReactNode }) {
  const { session, loading } = useAuth()
  const location = useLocation()

  if (loading) return <FullPageStatus>Loading…</FullPageStatus>
  if (!session) {
    // The front door gets the landing page in a browser. The installed app, and
    // deep links, go straight to sign-in; "Back to home" still reaches the landing page.
    if (location.pathname === '/' && !isInstalled()) return <Navigate to="/welcome" replace />
    return <Navigate to="/sign-in" replace state={{ from: location.pathname }} />
  }

  return <UserDataLoader userId={session.user.id}>{children}</UserDataLoader>
}

async function loadUserData(userId: string): Promise<LoadState> {
  const [profile, categories] = await Promise.all([
    supabase.from('profiles').select('*').eq('id', userId).maybeSingle(),
    fetchCategories(),
  ])

  const error = profile.error ?? categories.error
  if (error) return { status: 'error', message: error.message }
  // The handle_new_user trigger should have created this row at sign-up.
  if (!profile.data) return { status: 'error', message: "Your profile wasn't created when you signed up." }
  return { status: 'ready', profile: profile.data, allCategories: categories.data ?? [] }
}

function fetchCategories() {
  return supabase.from('categories').select('*').order('position').order('name')
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

  const updateProfile = useCallback(
    async (patch: TablesUpdate<'profiles'>) => {
      setState((s) => (s.status === 'ready' ? { ...s, profile: { ...s.profile, ...patch } } : s))
      const { error } = await supabase.from('profiles').update(patch).eq('id', userId)
      if (!error) return
      // Roll back by reloading what the server has.
      const { data } = await supabase.from('profiles').select('*').eq('id', userId).maybeSingle()
      if (data) setState((s) => (s.status === 'ready' ? { ...s, profile: data } : s))
      throw error
    },
    [userId],
  )

  const reloadCategories = useCallback(async () => {
    const { data, error } = await fetchCategories()
    if (error) throw error
    setState((s) => (s.status === 'ready' ? { ...s, allCategories: data } : s))
  }, [])

  const value = useMemo<UserData | null>(
    () =>
      state.status === 'ready'
        ? {
            profile: state.profile,
            allCategories: state.allCategories,
            categories: state.allCategories.filter((c) => !c.archived_at),
            updateProfile,
            reloadCategories,
          }
        : null,
    [state, updateProfile, reloadCategories],
  )

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
    <UserDataContext.Provider value={value}>
      {children}
    </UserDataContext.Provider>
  )
}
