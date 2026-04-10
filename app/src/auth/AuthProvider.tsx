import { useEffect, useMemo, useState } from 'react'
import { apiFetch } from '../api'
import { AuthContext, type AuthContextValue } from './context'
import type { AuthStatus, ConsumerMe } from './types'

const tokenKey = 'xpay_consumer_token'
const meKey = 'xpay_consumer_me'

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [token, setToken] = useState<string | null>(() => localStorage.getItem(tokenKey))
  const [me, setMe] = useState<ConsumerMe | null>(() => {
    const raw = localStorage.getItem(meKey)
    if (!raw) return null
    try {
      return JSON.parse(raw) as ConsumerMe
    } catch {
      return null
    }
  })
  const [status, setStatus] = useState<AuthStatus>(() => (localStorage.getItem(tokenKey) && localStorage.getItem(meKey) ? 'authed' : 'loading'))

  useEffect(() => {
    let cancelled = false
    async function boot() {
      if (!token) {
        setStatus('anon')
        setMe(null)
        localStorage.removeItem(meKey)
        return
      }
      try {
        const data = await apiFetch<ConsumerMe>('/api/consumer/me', { token })
        if (cancelled) return
        setMe(data)
        localStorage.setItem(meKey, JSON.stringify(data))
        setStatus('authed')
      } catch (err: unknown) {
        if (cancelled) return
        const status = err && typeof err === 'object' && 'status' in err ? Number((err as { status: number }).status) : null
        if (status === 401) {
          localStorage.removeItem(tokenKey)
          localStorage.removeItem(meKey)
          setToken(null)
          setMe(null)
          setStatus('anon')
          return
        }
        const hasCachedMe = Boolean(localStorage.getItem(meKey))
        setStatus(hasCachedMe ? 'authed' : 'loading')
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
        localStorage.setItem(meKey, JSON.stringify(nextMe))
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
        localStorage.setItem(meKey, JSON.stringify(nextMe))
        setStatus('authed')
      },
      logout: () => {
        localStorage.removeItem(tokenKey)
        localStorage.removeItem(meKey)
        setToken(null)
        setMe(null)
        setStatus('anon')
      },
    }
  }, [me, status, token])

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
