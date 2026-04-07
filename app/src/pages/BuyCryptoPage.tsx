import { useState } from 'react'

const coins = ['USDT', 'BTC', 'ETH'] as const
type Coin = (typeof coins)[number]

export function BuyCryptoPage() {
  const [coin, setCoin] = useState<Coin>('USDT')
  const [usd, setUsd] = useState('')

  return (
    <div className="container">
      <div className="h4 mb-3">Buy Crypto</div>
      <div className="card shadow-sm">
        <div className="card-body">
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
            <label className="form-label">You get (USD value)</label>
            <input className="form-control" value={usd} onChange={(e) => setUsd(e.target.value)} inputMode="decimal" />
          </div>

          <div className="alert alert-secondary">
            <div className="fw-semibold">Quotes unavailable</div>
            <div className="text-muted small">Enable trading integrations to fetch live pricing.</div>
          </div>

          <button className="btn btn-primary w-100" disabled>
            Pay with Debit Card
          </button>
        </div>
      </div>
    </div>
  )
}
