import { useState } from 'react'

const coins = ['BTC', 'ETH', 'USDT'] as const
type Coin = (typeof coins)[number]

export function SellCryptoPage() {
  const [coin, setCoin] = useState<Coin>('BTC')
  const [amount, setAmount] = useState('')

  return (
    <div className="container">
      <div className="h4 mb-3">Sell Crypto</div>
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
            <label className="form-label">Amount</label>
            <input className="form-control" value={amount} onChange={(e) => setAmount(e.target.value)} inputMode="decimal" />
          </div>

          <div className="alert alert-secondary">
            <div className="fw-semibold">Quotes unavailable</div>
            <div className="text-muted small">Enable trading integrations to fetch live pricing.</div>
          </div>

          <button className="btn btn-primary w-100" disabled>
            Sell Now
          </button>
        </div>
      </div>
    </div>
  )
}
