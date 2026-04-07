import { useMemo, useState } from 'react'

const brands = ['Amazon', 'iTunes', 'Google Play', 'Steam', 'Walmart', 'Visa', 'Amex', 'eBay'] as const
type Brand = (typeof brands)[number]

export function CardsPage() {
  const [tab, setTab] = useState<'sell' | 'buy'>('sell')
  const [brand, setBrand] = useState<Brand>('Amazon')
  const [value, setValue] = useState('100')

  const sellOffer = useMemo(() => {
    const v = Number(value || '0')
    const buyPct = brand === 'Visa' || brand === 'Amex' ? 0.65 : brand === 'Steam' ? 0.8 : brand === 'Amazon' ? 0.75 : 0.7
    return v * buyPct
  }, [brand, value])

  const buyPrice = useMemo(() => {
    const v = Number(value || '0')
    const sellPct = brand === 'Steam' ? 0.9 : brand === 'Amazon' ? 0.85 : 0.82
    return v * sellPct
  }, [brand, value])

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
                Offer: <span className="fw-bold">{sellOffer.toFixed(2)} USDT</span>
                <div className="text-muted small mt-1">Upload front/back • OCR code • Admin review (SLA &lt; 15 min)</div>
              </div>
              <button className="btn btn-primary w-100">Submit Gift Card (Preview)</button>
            </div>
          ) : (
            <div className="mt-3">
              <div className="alert alert-primary">
                Price: <span className="fw-bold">{buyPrice.toFixed(2)} USD</span>
                <div className="text-muted small mt-1">Instant code reveal • Inventory-based</div>
              </div>
              <button className="btn btn-primary w-100">Buy Now (Preview)</button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

