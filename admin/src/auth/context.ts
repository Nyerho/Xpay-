import { createContext } from 'react'
import type { AuthStatus, Me } from './types'

export type AuthContextValue = {
  status: AuthStatus
  token: string | null
  me: Me | null
  login: (email: string, password: string) => Promise<void>
  logout: () => void
}

export const AuthContext = createContext<AuthContextValue | null>(null)
