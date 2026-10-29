import { useEffect, useState, type ReactNode } from 'react'
import { clearOfflineData } from '../../lib/offline'
import { supabase } from '../../lib/supabase'
import { AuthContext, type AuthState } from './auth-context'

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({ session: null, loading: true })

  useEffect(() => {
    // Fires once with the stored session (INITIAL_SESSION), then on every sign-in/out.
    const { data } = supabase.auth.onAuthStateChange((event, session) => {
      // Don't leave the last user's data readable on a shared device.
      if (event === 'SIGNED_OUT') void clearOfflineData()
      setState({ session, loading: false })
    })
    return () => data.subscription.unsubscribe()
  }, [])

  return <AuthContext.Provider value={state}>{children}</AuthContext.Provider>
}
