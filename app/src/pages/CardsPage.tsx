import { useEffect, useMemo, useState } from 'react'
import { apiFetch } from '../api'

const brands = ['Amazon', 'iTunes', 'Google Play', 'Steam', 'Walmart', 'Visa', 'Amex', 'eBay'] as const
type Brand = (typeof brands)[number]

type Rate = { buyPct: number; sellPct: number }

export function CardsPage() {
  const [tab, setTab] = useState<'sell' | 'buy'>('sell')
  const [brand, setBrand] = useState<Brand>('Amazon')
  const [value, setValue] = useState('')
  const [rates, setRates] = useState<Record<string, Rate> | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setLoading(true)
    setError(null)
    apiFetch<{ valueJson: string }>('/api/public/gift-card-rates')
      .then((r) => {
        const parsed = JSON.parse(r.valueJson) as Record<string, Rate>
        setRates(parsed)
      })
      .catch((e: unknown) => {
        const msg = e && typeof e === 'object' && 'error' in e ? String((e as { error: string }).error) : 'load_failed'
        setError(msg)
      })
      .finally(() => setLoading(false))
  }, [])

  const sellOffer = useMemo(() => {
    if (!rates) return null
    const v = Number(value || '0')
    const key = brand.toUpperCase().replaceAll(' ', '_')
    const rate = rates[key]
    if (!rate) return null
    return v * rate.buyPct
  }, [brand, rates, value])

  const buyPrice = useMemo(() => {
    if (!rates) return null
    const v = Number(value || '0')
    const key = brand.toUpperCase().replaceAll(' ', '_')
    const rate = rates[key]
    if (!rate) return null
    return v * rate.sellPct
  }, [brand, rates, value])

  return (
    <div className="container">
      <div className="h4 mb-3">Gift Cards</div>

      <ul className="nav nav-pills mb-3">
        <li className="nav-item">
          <button className={`nav-link ${tab === 'sell' ? 'active' : ''}`} onClick={() => setTab('sell')}>
            Sell
          </button>
        </li>
        <li className="nav-item">
          <button className={`nav-link ${tab === 'buy' ? 'active' : ''}`} onClick={() => setTab('buy')}>
            Buy
          </button>
        </li>
      </ul>

      <div className="card shadow-sm">
        <div className="card-body">
          {error ? <div className="alert alert-danger py-2">{error}</div> : null}
          <div className="row g-2">
            <div className="col-12 col-md-6">
              <label className="form-label">Brand</label>
              <select className="form-select" value={brand} onChange={(e) => setBrand(e.target.value as Brand)}>
                {brands.map((b) => (
                  <option key={b} value={b}>
                    {b}
                  </option>
                ))}
              </select>
            </div>
            <div className="col-12 col-md-6">
              <label className="form-label">Value (USD)</label>
              <input className="form-control" value={value} onChange={(e) => setValue(e.target.value)} inputMode="decimal" />
            </div>
          </div>

          {tab === 'sell' ? (
            <div className="mt-3">
              <div className="alert alert-primary">
                Offer:{' '}
                <span className="fw-bold">
                  {loading ? '—' : sellOffer === null ? '—' : `${sellOffer.toFixed(2)} USDT`}
                </span>
                <div className="text-muted small mt-1">Rates come from server settings. Submission requires image upload integration.</div>
              </div>
              <button className="btn btn-primary w-100" disabled>
                Submit Gift Card
              </button>
            </div>
          ) : (
            <div className="mt-3">
              <div className="alert alert-primary">
                Price:{' '}
                <span className="fw-bold">
                  {loading ? '—' : buyPrice === null ? '—' : `$${buyPrice.toFixed(2)}`}
                </span>
                <div className="text-muted small mt-1">Rates come from server settings. Purchase requires inventory + fulfillment.</div>
              </div>
              <button className="btn btn-primary w-100" disabled>
                Buy Now
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
