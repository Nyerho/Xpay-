import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { apiFetch } from '../api'
import { useAuth } from '../auth/useAuth'

const assets = ['USDT', 'BTC', 'ETH'] as const
type Asset = (typeof assets)[number]
type Rail = 'TRC20' | 'ERC20' | 'BTC' | 'ETH'

export function SendPage() {
  const { token } = useAuth()
  const navigate = useNavigate()
  const [asset, setAsset] = useState<Asset>('USDT')
  const [rail, setRail] = useState<Rail>('TRC20')
  const [amount, setAmount] = useState('')
  const [address, setAddress] = useState('')
  const [memo, setMemo] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  return (
    <div className="container xpay-fade-in" style={{ maxWidth: 760 }}>
      <div className="d-flex align-items-center justify-content-between mb-3">
        <div className="h4 mb-0">Send</div>
        <button className="btn btn-sm btn-outline-light" type="button" onClick={() => navigate('/wallet')}>
          Wallet
        </button>
      </div>

      {error ? <div className="alert alert-danger py-2">{error}</div> : null}

      <div className="card xpay-card shadow-sm">
        <div className="card-body">
          <div className="row g-2">
            <div className="col-6">
              <label className="form-label">Asset</label>
              <select
                className="form-select"
                value={asset}
                onChange={(e) => {
                  const next = e.target.value as Asset
                  setAsset(next)
                  if (next === 'BTC') setRail('BTC')
                  if (next === 'ETH') setRail('ETH')
                  if (next === 'USDT') setRail('TRC20')
                }}
              >
                {assets.map((a) => (
                  <option key={a} value={a}>
                    {a}
                  </option>
                ))}
              </select>
            </div>
            <div className="col-6">
              <label className="form-label">Network</label>
              <select
                className="form-select"
                value={rail}
                onChange={(e) => setRail(e.target.value as Rail)}
                disabled={asset === 'BTC' || asset === 'ETH'}
              >
                {asset === 'USDT' ? (
                  <>
                    <option value="TRC20">TRC20</option>
                    <option value="ERC20">ERC20</option>
                  </>
                ) : asset === 'BTC' ? (
                  <option value="BTC">Bitcoin</option>
                ) : (
                  <option value="ETH">Ethereum</option>
                )}
              </select>
            </div>
          </div>

          <div className="row g-2 mt-2">
            <div className="col-12 col-md-4">
              <label className="form-label">Amount</label>
              <input className="form-control" value={amount} onChange={(e) => setAmount(e.target.value)} inputMode="decimal" />
            </div>
            <div className="col-12 col-md-8">
              <label className="form-label">Destination address</label>
              <input className="form-control font-monospace" value={address} onChange={(e) => setAddress(e.target.value)} />
            </div>
          </div>

          <div className="mt-2">
            <label className="form-label">Memo / Tag (optional)</label>
            <input className="form-control" value={memo} onChange={(e) => setMemo(e.target.value)} />
          </div>

          <div className="text-muted small mt-2">
            Submitting creates a withdrawal request. A finance operator reviews and settles withdrawals.
          </div>

          <button
            className="btn btn-primary w-100 mt-3"
            disabled={!token || busy || !amount.trim() || !address.trim()}
            type="button"
            onClick={() => {
              if (!token) return
              setBusy(true)
              setError(null)
              apiFetch<{ id: string; status: string }>('/api/consumer/withdrawals', {
                method: 'POST',
                token,
                body: { asset, rail: asset === 'BTC' ? 'BTC' : asset === 'ETH' ? 'ETH' : rail, amount: amount.trim(), address: address.trim(), memo: memo.trim() || undefined },
              })
                .then(() => navigate('/activity'))
                .catch((e: unknown) => {
                  const msg = e && typeof e === 'object' && 'error' in e ? String((e as { error: string }).error) : 'withdraw_failed'
                  setError(msg)
                })
                .finally(() => setBusy(false))
            }}
          >
            {busy ? 'Submitting…' : 'Submit withdrawal'}
          </button>
        </div>
      </div>
    </div>
  )
}

