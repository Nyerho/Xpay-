import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { apiFetch } from '../api'
import { useAuth } from '../auth/useAuth'

export function WalletPage() {
  const { token } = useAuth()
  const [balance, setBalance] = useState<{ usdCents: number; usdtCents: number; btcSats: number; ethWei: string } | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!token) return
    setLoading(true)
    setError(null)
    apiFetch<{ usdCents: number; usdtCents: number; btcSats: number; ethWei: string }>('/api/consumer/balance', { token })
      .then(setBalance)
      .catch((e: unknown) => {
        const msg = e && typeof e === 'object' && 'error' in e ? String((e as { error: string }).error) : 'load_failed'
        setError(msg)
      })
      .finally(() => setLoading(false))
  }, [token])

  const assets = balance
    ? [
        { symbol: 'USD', name: 'USD Balance', amount: (balance.usdCents / 100).toFixed(2), sub: 'Spendable' },
        { symbol: 'USDT', name: 'USDT', amount: (balance.usdtCents / 100).toFixed(2), sub: 'TRC20 / ERC20' },
        { symbol: 'BTC', name: 'Bitcoin', amount: String(balance.btcSats), sub: 'sats' },
        { symbol: 'ETH', name: 'Ethereum', amount: balance.ethWei, sub: 'wei' },
      ]
    : []

  return (
    <div className="container xpay-fade-in">
      <div className="h4 mb-3">Wallet</div>
      {error ? <div className="alert alert-danger py-2">{error}</div> : null}
      <div className="card xpay-card shadow-sm">
        <div className="list-group list-group-flush">
          {loading || !balance ? (
            <div className="list-group-item text-muted">Loading…</div>
          ) : null}
          {!loading && balance && assets.length === 0 ? <div className="list-group-item text-muted">No assets</div> : null}
          {assets.map((a) => (
            <div key={a.symbol} className="list-group-item d-flex justify-content-between align-items-center">
              <div>
                <div className="fw-semibold">{a.name}</div>
                <div className="text-muted small">{a.sub}</div>
              </div>
              <div className="text-end">
                <div className="fw-bold">{a.amount}</div>
                <div className="text-muted small">{a.symbol}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
      <div className="row g-2 mt-3">
        <div className="col-6">
          <Link className="btn btn-outline-primary w-100" to="/deposit">
            Receive
          </Link>
        </div>
        <div className="col-6">
          <Link className="btn btn-primary w-100" to="/send">
            Send
          </Link>
        </div>
      </div>
    </div>
  )
}
