import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { getCurrentUser, login as loginRequest, type AuthenticatedUser } from './api'

const TOKEN_KEY = 'gateway_access_token'
const USER_KEY = 'gateway_user'

interface AuthContextValue {
  token: string | null
  user: AuthenticatedUser | null
  isLoading: boolean
  signIn: (identifier: string, password: string) => Promise<void>
  signOut: () => void
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined)

function readUser(): AuthenticatedUser | null {
  try {
    const stored = localStorage.getItem(USER_KEY)
    return stored ? JSON.parse(stored) as AuthenticatedUser : null
  } catch {
    return null
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState(() => localStorage.getItem(TOKEN_KEY))
  const [user, setUser] = useState<AuthenticatedUser | null>(readUser)
  const [isLoading, setIsLoading] = useState(Boolean(token))

  useEffect(() => {
    if (!token) {
      setIsLoading(false)
      return
    }
    getCurrentUser(token).then(currentUser => {
      setUser(currentUser)
      localStorage.setItem(USER_KEY, JSON.stringify(currentUser))
    }).catch(() => {
      localStorage.removeItem(TOKEN_KEY)
      localStorage.removeItem(USER_KEY)
      setToken(null)
      setUser(null)
    }).finally(() => setIsLoading(false))
  }, [token])

  const value = useMemo<AuthContextValue>(() => ({
    token,
    user,
    isLoading,
    async signIn(identifier, password) {
      const result = await loginRequest(identifier, password)
      localStorage.setItem(TOKEN_KEY, result.accessToken)
      localStorage.setItem(USER_KEY, JSON.stringify(result.user))
      setToken(result.accessToken)
      setUser(result.user)
    },
    signOut() {
      localStorage.removeItem(TOKEN_KEY)
      localStorage.removeItem(USER_KEY)
      setToken(null)
      setUser(null)
    },
  }), [isLoading, token, user])

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) throw new Error('useAuth must be used within AuthProvider')
  return context
}
