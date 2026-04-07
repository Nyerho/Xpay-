import { useEffect, useMemo, useState } from 'react'
import { apiFetch } from '../api'

type Biller = { name: string; category: string }

const billers: Biller[] = [
  { name: 'AT&T', category: 'Mobile' },
  { name: 'Verizon', category: 'Mobile' },
  { name: 'T-Mobile', category: 'Mobile' },
  { name: 'Comcast Xfinity', category: 'Internet' },
  { name: 'Spectrum', category: 'Internet' },
  { name: 'Cox', category: 'Internet' },
  { name: 'FPL', category: 'Electric' },
  { name: 'Duke Energy', category: 'Electric' },
  { name: 'ComEd', category: 'Electric' },
  { name: 'PG&E', category: 'Electric' },
]

export function BillsPage() {
  const [biller, setBiller] = useState(billers[0]!.name)
  const [acct, setAcct] = useState('')
  const [amountUsd, setAmountUsd] = useState('')
  const [payFrom, setPayFrom] = useState<'USD' | 'USDT'>('USDT')
  const [spreadBps, setSpreadBps] = useState<number | null>(null)

  useEffect(() => {
    apiFetch<{ valueJson: string }>('/api/public/spreads')
      .then((r) => {
        const v = JSON.parse(r.valueJson) as { fixedSpreadBps?: number }
        setSpreadBps(typeof v.fixedSpreadBps === 'number' ? v.fixedSpreadBps : null)
      })
      .catch(() => {
        setSpreadBps(null)
      })
  }, [])

  const quote = useMemo(() => {
    const amt = Number(amountUsd || '0')
    const spread = spreadBps === null ? 0 : spreadBps / 10000
    return payFrom === 'USDT' ? amt * (1 + spread) : amt
  }, [amountUsd, payFrom, spreadBps])

  return (
    <div className="container">
      <div className="h4 mb-3">Pay Bills</div>
      <div className="card shadow-sm">
        <div className="card-body">
          <div className="mb-3">
            <label className="form-label">Biller</label>
            <select className="form-select" value={biller} onChange={(e) => setBiller(e.target.value)}>
              {billers.map((b) => (
                <option key={b.name} value={b.name}>
                  {b.category} • {b.name}
                </option>
              ))}
            </select>
          </div>
          <div className="mb-3">
            <label className="form-label">Account #</label>
            <input className="form-control" value={acct} onChange={(e) => setAcct(e.target.value)} placeholder="Enter account number" />
          </div>
          <div className="row g-2">
            <div className="col-12 col-md-6">
              <label className="form-label">Amount (USD)</label>
              <input className="form-control" value={amountUsd} onChange={(e) => setAmountUsd(e.target.value)} inputMode="decimal" />
            </div>
            <div className="col-12 col-md-6">
              <label className="form-label">Pay From</label>
              <select className="form-select" value={payFrom} onChange={(e) => setPayFrom(e.target.value as 'USD' | 'USDT')}>
                <option value="USD">USD Balance</option>
                <option value="USDT">USDT (TRC20)</option>
              </select>
            </div>
          </div>

          <div className="alert alert-primary mt-3">
            {payFrom === 'USDT' ? (
              <>
                Pay <span className="fw-bold">{quote.toFixed(2)} USDT</span>
                <div className="text-muted small mt-1">2FA required • TRC20 used to save gas</div>
              </>
            ) : (
              <>
                Pay <span className="fw-bold">${quote.toFixed(2)}</span>
                <div className="text-muted small mt-1">2FA required</div>
              </>
            )}
          </div>

          <button className="btn btn-danger w-100" disabled>
            Pay Now
          </button>
        </div>
      </div>
    </div>
  )
}
