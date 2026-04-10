import { useEffect, useMemo, useState } from 'react'
import { apiFetch } from '../api'
import { useAuth } from '../auth/useAuth'
import { LoadingAnimation } from '../components/LoadingAnimation'

const coins = ['BTC', 'ETH', 'USDT'] as const
type Coin = (typeof coins)[number]

export function SellCryptoPage() {
  const { token } = useAuth()
  const [coin, setCoin] = useState<Coin>('BTC')
  const [amount, setAmount] = useState('')
  const [quotes, setQuotes] = useState<Record<string, { buyPriceUsdCents: number; sellPriceUsdCents: number }> | null>(null)
  const [loading, setLoading] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setLoading(true)
    apiFetch<{ quotes: Record<string, { buyPriceUsdCents: number; sellPriceUsdCents: number }> }>('/api/public/quotes')
      .then((r) => setQuotes(r.quotes))
      .catch(() => setQuotes(null))
      .finally(() => setLoading(false))
  }, [])

  const sellPrice = quotes?.[coin]?.sellPriceUsdCents ?? null
  const estUsd = useMemo(() => {
    const m = amount.trim().match(/^(\d+)(?:\.(\d+))?$/)
    if (!m || !sellPrice) return null
    const whole = m[1] ?? '0'
    const frac = m[2] ?? ''

    function toMinor(decimals: number) {
      const fracPadded = (frac + '0'.repeat(decimals)).slice(0, decimals)
      const digits = (whole.replace(/^0+/, '') || '0') + fracPadded
      try {
        return BigInt(digits)
      } catch {
        return null
      }
    }

    if (coin === 'USDT') {
      const minor = toMinor(2)
      if (!minor) return null
      return Number((minor * BigInt(sellPrice)) / 100n) / 100
    }
    if (coin === 'BTC') {
      const minor = toMinor(8)
      if (!minor) return null
      return Number((minor * BigInt(sellPrice)) / 100000000n) / 100
    }
    const minor = toMinor(18)
    if (!minor) return null
    return Number((minor * BigInt(sellPrice)) / 1000000000000000000n) / 100
  }, [amount, coin, sellPrice])

  return (
    <div className="container xpay-fade-in">
      <div className="h4 mb-3">Sell Crypto</div>
      <div className="card xpay-card shadow-sm">
        <div className="card-body">
          {error ? <div className="alert alert-danger py-2">{error}</div> : null}
          <div className="mb-3">
            <label className="form-label">Coin</label>
            <select className="form-select" value={coin} onChange={(e) => setCoin(e.target.value as Coin)}>
              {coins.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>
          <div className="mb-3">
            <label className="form-label">Amount</label>
            <input className="form-control" value={amount} onChange={(e) => setAmount(e.target.value)} inputMode="decimal" />
          </div>

          {loading ? <LoadingAnimation /> : null}
          {!loading && !sellPrice ? (
            <div className="alert alert-secondary">
              <div className="fw-semibold">Quotes unavailable</div>
              <div className="text-muted small">Set Admin → Settings → spreads (midUsd/buyBps/sellBps).</div>
            </div>
          ) : null}
          {sellPrice ? (
            <div className="alert alert-secondary">
              <div className="d-flex justify-content-between">
                <span className="text-muted">Sell price</span>
                <span className="fw-semibold">${(sellPrice / 100).toFixed(2)}</span>
              </div>
              <div className="d-flex justify-content-between">
                <span className="text-muted">Estimated USD</span>
                <span className="fw-semibold">{estUsd === null ? '—' : `$${estUsd.toFixed(2)}`}</span>
              </div>
            </div>
          ) : null}

          <button
            className="btn btn-primary w-100"
            disabled={!token || busy || !amount.trim() || !sellPrice}
            onClick={() => {
              if (!token) return
              setBusy(true)
              setError(null)
              apiFetch<{ ok: true }>('/api/consumer/trade/sell', { method: 'POST', token, body: { asset: coin, amount: amount.trim() } })
                .then(() => setAmount(''))
                .catch((e: unknown) => {
                  const msg = e && typeof e === 'object' && 'error' in e ? String((e as { error: string }).error) : 'sell_failed'
                  setError(msg)
                })
                .finally(() => setBusy(false))
            }}
          >
            {busy ? 'Processing…' : 'Sell now'}
          </button>
        </div>
      </div>
    </div>
  )
}
