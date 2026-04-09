import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { apiFetch } from '../api'
import { useAuth } from '../auth/useAuth'

const options = ['USD', 'NGN', 'USDT', 'BTC', 'ETH'] as const
type Opt = (typeof options)[number]

type Quotes = {
  quotes: Record<string, { buyPriceUsdCents: number; sellPriceUsdCents: number }>
}

type Fx = {
  valueJson: string
}

export function ConvertPage() {
  const { token } = useAuth()
  const navigate = useNavigate()
  const [from, setFrom] = useState<Opt>('USD')
  const [to, setTo] = useState<Opt>('USDT')
  const [amount, setAmount] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [quotes, setQuotes] = useState<Quotes | null>(null)
  const [fx, setFx] = useState<{ USDNGN: { mid: number; buyBps: number; sellBps: number } } | null>(null)

  useEffect(() => {
    apiFetch<Quotes>('/api/public/quotes')
      .then(setQuotes)
      .catch(() => setQuotes(null))
  }, [])

  useEffect(() => {
    apiFetch<Fx>('/api/public/fx')
      .then((r) => {
        const parsed = JSON.parse(r.valueJson || '{}') as { USDNGN?: { mid: number; buyBps: number; sellBps: number } }
        if (parsed && parsed.USDNGN) setFx({ USDNGN: parsed.USDNGN })
        else setFx(null)
      })
      .catch(() => setFx(null))
  }, [])

  const estimate = useMemo(() => {
    if (!amount.trim()) return null
    const m = amount.trim().match(/^(\d+)(?:\.(\d+))?$/)
    if (!m) return null

    const q = quotes?.quotes ?? null
    const usdngn = fx?.USDNGN ?? null
    const wholeStr = m[1] ?? '0'
    const fracStr = m[2] ?? ''

    function parseToMinor(decimals: number) {
      const frac = fracStr.slice(0, decimals)
      const fracPadded = frac + '0'.repeat(decimals - frac.length)
      const digits = (wholeStr.replace(/^0+/, '') || '0') + fracPadded
      try {
        return BigInt(digits)
      } catch {
        return null
      }
    }

    function usdCentsFrom(fromOpt: Opt) {
      if (fromOpt === 'USD') return parseToMinor(2)
      if (fromOpt === 'NGN') {
        if (!usdngn) return null
        const rateDiv = Math.max(1, Math.floor((usdngn.mid * (10000 + usdngn.buyBps)) / 10000))
        const kobo = parseToMinor(2)
        if (!kobo) return null
        return kobo / BigInt(rateDiv)
      }
      if (!q) return null
      if (fromOpt === 'USDT') {
        const minor = parseToMinor(2)
        if (!minor) return null
        return (minor * BigInt(q.USDT.sellPriceUsdCents)) / 100n
      }
      if (fromOpt === 'BTC') {
        const minor = parseToMinor(8)
        if (!minor) return null
        return (minor * BigInt(q.BTC.sellPriceUsdCents)) / 100000000n
      }
      if (fromOpt === 'ETH') {
        const minor = parseToMinor(18)
        if (!minor) return null
        return (minor * BigInt(q.ETH.sellPriceUsdCents)) / 1000000000000000000n
      }
      return null
    }

    function toFromUsdCents(toOpt: Opt, usdCents: bigint) {
      if (toOpt === 'USD') return usdCents
      if (toOpt === 'NGN') {
        if (!usdngn) return null
        const rate = Math.max(1, Math.floor((usdngn.mid * (10000 - usdngn.sellBps)) / 10000))
        return usdCents * BigInt(rate)
      }
      if (!q) return null
      if (toOpt === 'USDT') return (usdCents * 100n) / BigInt(q.USDT.buyPriceUsdCents)
      if (toOpt === 'BTC') return (usdCents * 100000000n) / BigInt(q.BTC.buyPriceUsdCents)
      if (toOpt === 'ETH') return (usdCents * 1000000000000000000n) / BigInt(q.ETH.buyPriceUsdCents)
      return null
    }

    const usdCents = usdCentsFrom(from)
    if (!usdCents || usdCents <= 0n) return null
    const outMinor = toFromUsdCents(to, usdCents)
    if (!outMinor || outMinor <= 0n) return null

    if (to === 'USD') return `$${(Number(outMinor) / 100).toFixed(2)}`
    if (to === 'NGN') return `₦${(Number(outMinor) / 100).toFixed(2)}`
    if (to === 'USDT') return `${(Number(outMinor) / 100).toFixed(2)} USDT`
    if (to === 'BTC') return `${Number(outMinor) / 100000000} BTC`
    return `${Number(outMinor) / 1e18} ETH`
  }, [amount, from, fx?.USDNGN, quotes?.quotes, to])

  return (
    <div className="container xpay-fade-in" style={{ maxWidth: 760 }}>
      <div className="d-flex align-items-center justify-content-between mb-3">
        <div className="h4 mb-0">Convert</div>
        <button className="btn btn-sm btn-outline-light" type="button" onClick={() => navigate('/wallet')}>
          Wallet
        </button>
      </div>

      {error ? <div className="alert alert-danger py-2">{error}</div> : null}

      <div className="card xpay-card shadow-sm">
        <div className="card-body">
          <div className="row g-2">
            <div className="col-6">
              <label className="form-label">From</label>
              <select className="form-select" value={from} onChange={(e) => setFrom(e.target.value as Opt)}>
                {options.map((o) => (
                  <option key={o} value={o}>
                    {o}
                  </option>
                ))}
              </select>
            </div>
            <div className="col-6">
              <label className="form-label">To</label>
              <select className="form-select" value={to} onChange={(e) => setTo(e.target.value as Opt)}>
                {options.map((o) => (
                  <option key={o} value={o}>
                    {o}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="mt-2">
            <label className="form-label">Amount</label>
            <input className="form-control" value={amount} onChange={(e) => setAmount(e.target.value)} inputMode="decimal" />
          </div>

          <div className="alert alert-secondary mt-3">
            <div className="d-flex justify-content-between">
              <span className="text-muted">Estimated</span>
              <span className="fw-semibold">{estimate ?? '—'}</span>
            </div>
          </div>

          <button
            className="btn btn-primary w-100"
            disabled={!token || busy || !amount.trim() || from === to}
            onClick={() => {
              if (!token) return
              setBusy(true)
              setError(null)
              apiFetch<{ ok: true }>('/api/consumer/convert', { method: 'POST', token, body: { from, to, amount: amount.trim() } })
                .then(() => navigate('/wallet'))
                .catch((e: unknown) => {
                  const msg = e && typeof e === 'object' && 'error' in e ? String((e as { error: string }).error) : 'convert_failed'
                  setError(msg)
                })
                .finally(() => setBusy(false))
            }}
          >
            {busy ? 'Processing…' : 'Convert'}
          </button>
        </div>
      </div>
    </div>
  )
}
