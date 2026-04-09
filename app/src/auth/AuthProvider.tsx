import { useEffect, useMemo, useState } from 'react'
import { apiFetch } from '../api'
import { AuthContext, type AuthContextValue } from './context'
import type { AuthStatus, ConsumerMe } from './types'

const tokenKey = 'xpay_consumer_token'

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [status, setStatus] = useState<AuthStatus>('loading')
  const [token, setToken] = useState<string | null>(() => localStorage.getItem(tokenKey))
  const [me, setMe] = useState<ConsumerMe | null>(null)

  useEffect(() => {
    let cancelled = false
    async function boot() {
      if (!token) {
        setStatus('anon')
        setMe(null)
        return
      }
      try {
        const data = await apiFetch<ConsumerMe>('/api/consumer/me', { token })
        if (cancelled) return
        setMe(data)
        setStatus('authed')
      } catch {
        if (cancelled) return
        localStorage.removeItem(tokenKey)
        setToken(null)
        setMe(null)
        setStatus('anon')
      }
    }
    void boot()
    return () => {
      cancelled = true
    }
  }, [token])

  const value = useMemo<AuthContextValue>(() => {
    return {
      status,
      token,
      me,
      signup: async (email: string, password: string, phone?: string, referralCode?: string, promoCode?: string) => {
        const res = await apiFetch<{ token: string }>('/api/consumer/auth/signup', {
          method: 'POST',
          body: { email, password, phone, referralCode: referralCode || undefined, promoCode: promoCode || undefined },
        })
        localStorage.setItem(tokenKey, res.token)
        setToken(res.token)
        const nextMe = await apiFetch<ConsumerMe>('/api/consumer/me', { token: res.token })
        setMe(nextMe)
        setStatus('authed')
      },
      login: async (email: string, password: string) => {
        const res = await apiFetch<{ token: string }>('/api/consumer/auth/login', {
          method: 'POST',
          body: { email, password },
        })
        localStorage.setItem(tokenKey, res.token)
        setToken(res.token)
        const nextMe = await apiFetch<ConsumerMe>('/api/consumer/me', { token: res.token })
        setMe(nextMe)
        setStatus('authed')
      },
      logout: () => {
        localStorage.removeItem(tokenKey)
        setToken(null)
        setMe(null)
        setStatus('anon')
      },
    }
  }, [me, status, token])

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
