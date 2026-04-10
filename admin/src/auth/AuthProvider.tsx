import { useEffect, useMemo, useState } from 'react'
import { apiFetch } from '../api'
import { AuthContext, type AuthContextValue } from './context'
import type { AuthStatus, Me, StaffRole } from './types'

const tokenKey = 'xpay_admin_token'

function readTokenFromHash() {
  if (typeof window === 'undefined') return null
  const h = window.location.hash || ''
  if (!h.includes('token=')) return null
  const raw = h.startsWith('#') ? h.slice(1) : h
  const params = new URLSearchParams(raw)
  const token = params.get('token')
  if (!token) return null
  params.delete('token')
  const nextHash = params.toString()
  const url = window.location.pathname + window.location.search + (nextHash ? `#${nextHash}` : '')
  window.history.replaceState({}, document.title, url)
  return token
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [status, setStatus] = useState<AuthStatus>('loading')
  const [token, setToken] = useState<string | null>(() => {
    const t = readTokenFromHash()
    if (t) {
      localStorage.setItem(tokenKey, t)
      return t
    }
    return localStorage.getItem(tokenKey)
  })
  const [me, setMe] = useState<Me | null>(null)

  useEffect(() => {
    let cancelled = false
    async function boot() {
      if (!token) {
        setStatus('anon')
        setMe(null)
        return
      }
      try {
        const data = await apiFetch<Me>('/api/auth/me', { token })
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
      login: async (email: string, password: string) => {
        const res = await apiFetch<{ token: string; user: { id: string; email: string; role: StaffRole } }>(
          '/api/auth/login',
          {
            method: 'POST',
            body: { email, password },
          },
        )
        localStorage.setItem(tokenKey, res.token)
        setToken(res.token)
        const nextMe = await apiFetch<Me>('/api/auth/me', { token: res.token })
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
