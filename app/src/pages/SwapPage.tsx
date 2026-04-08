import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { apiFetch } from '../api'
import { useAuth } from '../auth/useAuth'

const assets = ['BTC', 'ETH', 'USDT'] as const
type Asset = (typeof assets)[number]

export function SwapPage() {
  const { token } = useAuth()
  const navigate = useNavigate()
  const [fromAsset, setFromAsset] = useState<Asset>('BTC')
  const [toAsset, setToAsset] = useState<Asset>('USDT')
  const [amount, setAmount] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [createdId, setCreatedId] = useState<string | null>(null)

  return (
    <div className="container xpay-fade-in">
      <div className="d-flex align-items-center justify-content-between mb-3">
        <div className="h4 mb-0">Swap</div>
        <button className="btn btn-sm btn-outline-light" type="button" onClick={() => navigate('/activity')}>
          Activity
        </button>
      </div>

      <div className="card xpay-card shadow-sm">
        <div className="card-body">
          {error ? <div className="alert alert-danger py-2">{error}</div> : null}
          {createdId ? (
            <div className="alert alert-success">
              Swap request created: <span className="fw-semibold">{createdId}</span>
            </div>
          ) : null}

          <div className="row g-2">
            <div className="col-6">
              <label className="form-label">From</label>
              <select className="form-select" value={fromAsset} onChange={(e) => setFromAsset(e.target.value as Asset)}>
                {assets.map((a) => (
                  <option key={a} value={a}>
                    {a}
                  </option>
                ))}
              </select>
            </div>
            <div className="col-6">
              <label className="form-label">To</label>
              <select className="form-select" value={toAsset} onChange={(e) => setToAsset(e.target.value as Asset)}>
                {assets.map((a) => (
                  <option key={a} value={a}>
                    {a}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="mt-3">
            <label className="form-label">Amount</label>
            <input className="form-control" value={amount} onChange={(e) => setAmount(e.target.value)} inputMode="decimal" />
            <div className="text-muted small mt-2">Creates a real swap request. Execution requires liquidity integration.</div>
          </div>

          <button
            className="btn btn-primary w-100 mt-3"
            disabled={busy || !token || !amount.trim() || fromAsset === toAsset}
            type="button"
            onClick={() => {
              if (!token) return
              setBusy(true)
              setError(null)
              setCreatedId(null)
              apiFetch<{ id: string; status: string }>('/api/consumer/swap', {
                method: 'POST',
                token,
                body: { fromAsset, toAsset, amount: amount.trim() },
              })
                .then((r) => {
                  setCreatedId(r.id)
                  navigate('/activity')
                })
                .catch((e: unknown) => {
                  const msg =
                    e && typeof e === 'object' && 'error' in e ? String((e as { error: string }).error) : 'swap_failed'
                  setError(msg)
                })
                .finally(() => setBusy(false))
            }}
          >
            {busy ? 'Submitting…' : 'Create Swap Request'}
          </button>
        </div>
      </div>
    </div>
  )
}

