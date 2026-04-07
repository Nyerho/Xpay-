import { createContext } from 'react'
import type { AuthStatus, ConsumerMe } from './types'

export type AuthContextValue = {
  status: AuthStatus
  token: string | null
  me: ConsumerMe | null
  signup: (email: string, password: string, phone?: string) => Promise<void>
  login: (email: string, password: string) => Promise<void>
  logout: () => void
}

export const AuthContext = createContext<AuthContextValue | null>(null)
