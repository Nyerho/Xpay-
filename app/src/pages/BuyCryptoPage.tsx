import { useMemo, useState } from 'react'

const coins = ['USDT', 'BTC', 'ETH'] as const
type Coin = (typeof coins)[number]

export function BuyCryptoPage() {
  const [coin, setCoin] = useState<Coin>('USDT')
  const [usd, setUsd] = useState('200')

  const quote = useMemo(() => {
    const amount = Number(usd || '0')
    const spread = 0.02
    const pay = amount * (1 + spread)
    return { pay, receive: amount }
  }, [usd])

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

          <div className="alert alert-primary">
            <div className="d-flex justify-content-between">
              <div className="text-muted">You pay</div>
              <div className="fw-bold">${quote.pay.toFixed(2)}</div>
            </div>
            <div className="d-flex justify-content-between">
              <div className="text-muted">You get</div>
              <div className="fw-bold">
                {quote.receive.toFixed(2)} {coin}
              </div>
            </div>
            <div className="text-muted small mt-2">Quote lock: 15 minutes • Fixed spread: 2%</div>
          </div>

          <button className="btn btn-primary w-100">Pay with Debit Card (Preview)</button>
        </div>
      </div>
    </div>
  )
}

