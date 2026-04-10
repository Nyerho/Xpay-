import { useEffect, useMemo, useState } from 'react'
import { apiFetch } from '../api'
import { useAuth } from '../auth/useAuth'
import { TradingViewAdvancedChart } from '../components/TradingViewAdvancedChart'
import { LoadingAnimation } from '../components/LoadingAnimation'

const coins = ['USDT', 'BTC', 'ETH'] as const
type Coin = (typeof coins)[number]

export function BuyCryptoPage() {
  const { token } = useAuth()
  const [coin, setCoin] = useState<Coin>('USDT')
  const [usd, setUsd] = useState('')
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

  const usdCents = useMemo(() => {
    const m = usd.trim().match(/^(\d+)(?:\.(\d{0,2}))?$/)
    if (!m) return null
    const whole = Number(m[1] ?? '0')
    const frac = String(m[2] ?? '').padEnd(2, '0')
    const cents = whole * 100 + Number(frac || '0')
    return Number.isFinite(cents) && cents >= 100 ? cents : null
  }, [usd])

  const buyPrice = quotes?.[coin]?.buyPriceUsdCents ?? null
  const estReceive = useMemo(() => {
    if (!usdCents || !buyPrice) return null
    if (coin === 'USDT') return ((usdCents * 100) / buyPrice / 100).toFixed(2)
    if (coin === 'BTC') return ((usdCents * 100000000) / buyPrice / 100000000).toFixed(8)
    return ((usdCents * 1e18) / buyPrice / 1e18).toFixed(6)
  }, [buyPrice, coin, usdCents])

  return (
    <div className="container xpay-fade-in">
      <div className="h4 mb-3">Buy Crypto</div>
      <TradingViewAdvancedChart asset={coin} />
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
            <label className="form-label">Spend (USD)</label>
            <input className="form-control" value={usd} onChange={(e) => setUsd(e.target.value)} inputMode="decimal" />
            <div className="text-muted small mt-1">Minimum: $1.00</div>
          </div>

          {loading ? <LoadingAnimation /> : null}
          {!loading && !buyPrice ? (
            <div className="alert alert-secondary">
              <div className="fw-semibold">Quotes unavailable</div>
              <div className="text-muted small">Set Admin → Settings → spreads (midUsd/buyBps/sellBps).</div>
            </div>
          ) : null}
          {buyPrice ? (
            <div className="alert alert-secondary">
              <div className="d-flex justify-content-between">
                <span className="text-muted">Buy price</span>
                <span className="fw-semibold">${(buyPrice / 100).toFixed(2)}</span>
              </div>
              <div className="d-flex justify-content-between">
                <span className="text-muted">Estimated receive</span>
                <span className="fw-semibold">{estReceive ?? '—'} {coin}</span>
              </div>
            </div>
          ) : null}

          <button
            className="btn btn-primary w-100"
            disabled={!token || busy || !usdCents || !buyPrice}
            onClick={() => {
              if (!token || !usdCents) return
              setBusy(true)
              setError(null)
              apiFetch<{ ok: true }>('/api/consumer/trade/buy', { method: 'POST', token, body: { asset: coin, usdCents } })
                .then(() => {
                  setUsd('')
                })
                .catch((e: unknown) => {
                  const msg = e && typeof e === 'object' && 'error' in e ? String((e as { error: string }).error) : 'buy_failed'
                  setError(msg === 'min_usd_1' ? 'Minimum buy is $1.00' : msg)
                })
                .finally(() => setBusy(false))
            }}
          >
            {busy ? 'Processing…' : 'Buy now'}
          </button>
        </div>
      </div>
    </div>
  )
}
