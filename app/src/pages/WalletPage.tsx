import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { apiFetch } from '../api'
import { useAuth } from '../auth/useAuth'
import { LoadingAnimation } from '../components/LoadingAnimation'

function formatEth(wei: string) {
  try {
    const w = BigInt(wei)
    const scaled = w / 1000000000000n
    return (Number(scaled) / 1e6).toFixed(6)
  } catch {
    return null
  }
}

export function WalletPage() {
  const { token } = useAuth()
  const [balance, setBalance] = useState<{ usdCents: number; ngnKobo: number; usdtCents: number; btcSats: number; ethWei: string } | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(() => {
    if (!token) return
    setLoading(true)
    setError(null)
    apiFetch<{ usdCents: number; ngnKobo: number; usdtCents: number; btcSats: number; ethWei: string }>('/api/consumer/balance', { token })
      .then(setBalance)
      .catch((e: unknown) => {
        const msg = e && typeof e === 'object' && 'error' in e ? String((e as { error: string }).error) : 'load_failed'
        setError(msg)
      })
      .finally(() => setLoading(false))
  }, [token])

  useEffect(() => {
    load()
  }, [load])

  const assets = balance
    ? [
        { symbol: 'USD', name: 'USD Balance', amount: `$${(balance.usdCents / 100).toFixed(2)}`, sub: 'Spendable' },
        { symbol: 'NGN', name: 'Naira', amount: `₦${(balance.ngnKobo / 100).toFixed(2)}`, sub: 'Local' },
        { symbol: 'USDT', name: 'USDT', amount: (balance.usdtCents / 100).toFixed(2), sub: 'TRC20 / ERC20' },
        { symbol: 'BTC', name: 'Bitcoin', amount: (balance.btcSats / 100000000).toFixed(8), sub: 'BTC' },
        { symbol: 'ETH', name: 'Ethereum', amount: formatEth(balance.ethWei) ?? '—', sub: 'ETH' },
      ]
    : []

  return (
    <div className="container xpay-fade-in">
      <div className="d-flex align-items-center justify-content-between mb-3">
        <div className="h4 mb-0">Wallet</div>
        <button className="btn btn-sm btn-outline-light" type="button" onClick={load} disabled={!token || loading}>
          Refresh
        </button>
      </div>
      {error ? <div className="alert alert-danger py-2">{error}</div> : null}
      <div className="card xpay-card shadow-sm">
        <div className="list-group list-group-flush">
          {loading || !balance ? (
            <div className="list-group-item">
              <LoadingAnimation />
            </div>
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
        <div className="col-12">
          <Link className="btn btn-outline-light w-100" to="/convert">
            Convert
          </Link>
        </div>
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
