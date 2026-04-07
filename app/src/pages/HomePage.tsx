import { Link } from 'react-router-dom'
import { useEffect, useState } from 'react'
import { apiFetch } from '../api'
import { useAuth } from '../auth/useAuth'

function ActionButton(props: { to: string; label: string; variant: string }) {
  return (
    <div className="col-6">
      <Link to={props.to} className={`btn ${props.variant} w-100 py-3 fw-semibold`}>
        {props.label}
      </Link>
    </div>
  )
}

export function HomePage() {
  const { token } = useAuth()
  const [usdCents, setUsdCents] = useState<number | null>(null)
  const [kycStatus, setKycStatus] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!token) return
    setLoading(true)
    setError(null)
    Promise.all([
      apiFetch<{ usdCents: number; usdtCents: number; btcSats: number; ethWei: string }>('/api/consumer/balance', { token }),
      apiFetch<{ status: string }>('/api/consumer/kyc', { token }),
    ])
      .then(([b, k]) => {
        setUsdCents(b.usdCents + b.usdtCents)
        setKycStatus(k.status)
      })
      .catch((e: unknown) => {
        const msg = e && typeof e === 'object' && 'error' in e ? String((e as { error: string }).error) : 'load_failed'
        setError(msg)
      })
      .finally(() => setLoading(false))
  }, [token])

  return (
    <div className="container">
      <div className="card shadow-sm mb-3">
        <div className="card-body">
          <div className="d-flex justify-content-between align-items-start">
            <div>
              <div className="text-muted small">USD Balance</div>
              <div className="h2 mb-0">
                {loading || usdCents === null ? '—' : `$${(usdCents / 100).toFixed(2)}`}
              </div>
              <div className="text-muted small">Fiat + USDT spending power</div>
            </div>
            <span className={`badge ${kycStatus === 'APPROVED' ? 'bg-success' : 'bg-secondary'}`}>
              {kycStatus ?? 'KYC'}
            </span>
          </div>
        </div>
      </div>

      <div className="row g-2 mb-3">
        <ActionButton to="/buy" label="Buy" variant="btn-primary" />
        <ActionButton to="/sell" label="Sell" variant="btn-outline-primary" />
        <ActionButton to="/cards" label="Cards" variant="btn-outline-dark" />
        <ActionButton to="/bills" label="Pay Bills" variant="btn-danger" />
      </div>

      {error ? <div className="alert alert-danger py-2">{error}</div> : null}

      <div className="card shadow-sm">
        <div className="card-body">
          <div className="fw-bold mb-2">Status</div>
          <div className="text-muted small">No demo activity. Check Activity tab after you transact.</div>
        </div>
      </div>
    </div>
  )
}
