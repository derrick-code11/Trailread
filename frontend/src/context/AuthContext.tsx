import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react'

import { type AuthUser, AuthApiError, getMe } from '@/lib/authApi'

type AuthState = {
  user: AuthUser | null
  loading: boolean
  error: string | null
  refresh: () => Promise<void>
}

const AuthContext = createContext<AuthState | undefined>(undefined)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const { user: u } = await getMe()
      setUser(u)
    } catch (e) {
      if (e instanceof AuthApiError && e.status === 401) {
        setUser(null)
      } else {
        const msg = e instanceof AuthApiError ? e.message : 'Could not load session.'
        setError(msg)
        setUser(null)
      }
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    /* eslint-disable react-hooks/set-state-in-effect -- load session from cookie on mount */
    void refresh()
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [refresh])

  const value = useMemo(
    () => ({ user, loading, error, refresh }),
    [user, loading, error, refresh],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

/** Auth consumer hook (paired with {@link AuthProvider}). */
// eslint-disable-next-line react-refresh/only-export-components -- hook must live next to provider context
export function useAuth(): AuthState {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
