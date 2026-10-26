import { useEffect, useState, type ReactNode } from 'react'
import { supabase } from '../../lib/supabase'
import { AuthContext, type AuthState } from './auth-context'

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({ session: null, loading: true })

  useEffect(() => {
    // Fires once with the stored session (INITIAL_SESSION), then on every sign-in/out.
    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      setState({ session, loading: false })
    })
    return () => data.subscription.unsubscribe()
  }, [])

  return <AuthContext.Provider value={state}>{children}</AuthContext.Provider>
}
