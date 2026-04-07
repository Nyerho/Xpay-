import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../auth/useAuth'

export function LoginPage() {
  const { status, login } = useAuth()
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  if (status === 'authed') {
    navigate('/')
  }

  return (
    <div className="min-vh-100 d-flex align-items-center bg-light">
      <div className="container" style={{ maxWidth: 520 }}>
        <div className="card shadow-sm">
          <div className="card-body p-4">
            <div className="h4 mb-1 fw-bold">
              <span style={{ color: '#B31942' }}>x</span>
              <span style={{ color: '#0A3161' }}>pay</span> Admin
            </div>
            <div className="text-muted mb-4">Staff only</div>

            {error ? <div className="alert alert-danger py-2">{error}</div> : null}

            <form
              onSubmit={(e) => {
                e.preventDefault()
                setBusy(true)
                setError(null)
                login(email.trim(), password)
                  .then(() => navigate('/'))
                  .catch((err: unknown) => {
                    const msg =
                      err && typeof err === 'object' && 'error' in err
                        ? String((err as { error: string }).error)
                        : 'login_failed'
                    setError(msg)
                  })
                  .finally(() => setBusy(false))
              }}
            >
              <div className="mb-3">
                <label className="form-label">Email</label>
                <input
                  className="form-control"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  autoComplete="email"
                  required
                />
              </div>
              <div className="mb-3">
                <label className="form-label">Password</label>
                <input
                  className="form-control"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="current-password"
                  required
                />
              </div>
              <button className="btn btn-primary w-100" disabled={busy}>
                {busy ? 'Signing in…' : 'Sign in'}
              </button>
            </form>

            <div className="mt-3 text-muted small">
              Default god user comes from server/.env: GOD_EMAIL + GOD_PASSWORD
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
