import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../auth/useAuth'

export function LoginPage() {
  const { status, login, signup } = useAuth()
  const navigate = useNavigate()
  const [mode, setMode] = useState<'login' | 'signup'>('login')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [password, setPassword] = useState('')
  const [referralCode, setReferralCode] = useState('')
  const [promoCode, setPromoCode] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (status === 'authed') {
    navigate('/')
  }

  return (
    <div className="container xpay-fade-in" style={{ maxWidth: 520 }}>
      <div className="card xpay-card shadow-sm">
        <div className="card-body p-4">
          <div className="h4 mb-1 fw-bold">
            <span className="xpay-logo-x">x</span>
            <span className="xpay-logo">pay</span>
          </div>
          <div className="text-muted mb-3">Sign in to continue</div>

          <div className="btn-group w-100 mb-3">
            <button
              className={`btn ${mode === 'login' ? 'btn-primary' : 'btn-outline-primary'}`}
              onClick={() => setMode('login')}
              type="button"
            >
              Login
            </button>
            <button
              className={`btn ${mode === 'signup' ? 'btn-primary' : 'btn-outline-primary'}`}
              onClick={() => setMode('signup')}
              type="button"
            >
              Sign up
            </button>
          </div>

          {error ? <div className="alert alert-danger py-2">{error}</div> : null}

          <form
            onSubmit={(e) => {
              e.preventDefault()
              setBusy(true)
              setError(null)
              const run =
                mode === 'login'
                  ? login(email.trim(), password)
                  : signup(
                      email.trim(),
                      password,
                      phone.trim() ? phone.trim() : undefined,
                      referralCode.trim() ? referralCode.trim() : undefined,
                      promoCode.trim() ? promoCode.trim() : undefined,
                    )
              run
                .then(() => navigate('/'))
                .catch((err: unknown) => {
                  const code = err && typeof err === 'object' && 'error' in err ? String((err as { error: string }).error) : null
                  const status = err && typeof err === 'object' && 'status' in err ? Number((err as { status: number }).status) : null

                  if (status === 401) {
                    setError('Invalid email or password')
                    return
                  }
                  if (code === 'network_error') {
                    setError('Network error. Please try again.')
                    return
                  }
                  if (code === 'request_failed') {
                    setError('Server error. Please try again.')
                    return
                  }
                  if (code) {
                    setError(code)
                    return
                  }
                  setError('Login failed. Please try again.')
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

            {mode === 'signup' ? (
              <div className="mb-3">
                <label className="form-label">Phone (optional)</label>
                <input className="form-control" value={phone} onChange={(e) => setPhone(e.target.value)} autoComplete="tel" />
              </div>
            ) : null}

            <div className="mb-3">
              <label className="form-label">Password</label>
              <input
                className="form-control"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                minLength={8}
                required
              />
            </div>

            {mode === 'signup' ? (
              <div className="row g-2 mb-3">
                <div className="col-12 col-md-6">
                  <label className="form-label">Referral code (optional)</label>
                  <input className="form-control" value={referralCode} onChange={(e) => setReferralCode(e.target.value)} />
                </div>
                <div className="col-12 col-md-6">
                  <label className="form-label">Promo code (optional)</label>
                  <input className="form-control" value={promoCode} onChange={(e) => setPromoCode(e.target.value)} />
                </div>
              </div>
            ) : null}

            <button className="btn btn-primary w-100" disabled={busy}>
              {busy ? 'Please wait…' : mode === 'login' ? 'Login' : 'Create account'}
            </button>
          </form>

          <div className="text-muted small mt-3">
            Balances and activity load from your account.
          </div>
        </div>
      </div>
    </div>
  )
}
