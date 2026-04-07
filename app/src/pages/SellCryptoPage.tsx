import { useMemo, useState } from 'react'

const coins = ['BTC', 'ETH', 'USDT'] as const
type Coin = (typeof coins)[number]

export function SellCryptoPage() {
  const [coin, setCoin] = useState<Coin>('BTC')
  const [amount, setAmount] = useState('0.01')

  const quote = useMemo(() => {
    const a = Number(amount || '0')
    const usdRate = coin === 'BTC' ? 58200 : coin === 'ETH' ? 3200 : 1
    const gross = a * usdRate
    const spread = 0.02
    const net = gross * (1 - spread)
    return { gross, net }
  }, [amount, coin])

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

          <div className="alert alert-primary">
            <div className="d-flex justify-content-between">
              <div className="text-muted">Quote</div>
              <div className="fw-bold">${quote.net.toFixed(2)} USD</div>
            </div>
            <div className="text-muted small mt-2">Fixed spread: 2% • Instant USD credit (Preview)</div>
          </div>

          <button className="btn btn-primary w-100">Sell Now (Preview)</button>
        </div>
      </div>
    </div>
  )
}

