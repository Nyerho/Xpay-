import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { apiFetch } from '../api'
import { useAuth } from '../auth/useAuth'

export function SendPage() {
  const { token } = useAuth()
  const navigate = useNavigate()
  const [method, setMethod] = useState<'USDC' | 'NGN'>('USDC')
  const [amountUsd, setAmountUsd] = useState('')
  const [address, setAddress] = useState('')
  const [memo, setMemo] = useState('')
  const [amountNgn, setAmountNgn] = useState('')
  const [bankName, setBankName] = useState('')
  const [accountName, setAccountName] = useState('')
  const [accountNumber, setAccountNumber] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const usdCents = useMemo(() => {
    const m = amountUsd.trim().match(/^(\d+)(?:\.(\d{0,2}))?$/)
    if (!m) return null
    const whole = Number(m[1] ?? '0')
    const frac = String(m[2] ?? '').padEnd(2, '0')
    const cents = whole * 100 + Number(frac || '0')
    return Number.isFinite(cents) && cents >= 100 ? cents : null
  }, [amountUsd])

  const ngnAmount = useMemo(() => {
    const m = amountNgn.trim().match(/^(\d+)(?:\.(\d{0,2}))?$/)
    if (!m) return null
    const whole = Number(m[1] ?? '0')
    const frac = String(m[2] ?? '').padEnd(2, '0')
    const kobo = whole * 100 + Number(frac || '0')
    return Number.isFinite(kobo) && kobo >= 100 ? amountNgn.trim() : null
  }, [amountNgn])

  return (
    <div className="container xpay-fade-in" style={{ maxWidth: 760 }}>
      <div className="d-flex align-items-center justify-content-between mb-3">
        <div className="h4 mb-0">Send</div>
        <button className="btn btn-sm btn-outline-light" type="button" onClick={() => navigate('/wallet')}>
          Wallet
        </button>
      </div>

      {error ? <div className="alert alert-danger py-2">{error}</div> : null}

      <div className="card xpay-card shadow-sm">
        <div className="card-body">
          <div className="mb-2">
            <label className="form-label">Withdraw to</label>
            <select className="form-select" value={method} onChange={(e) => setMethod(e.target.value as 'USDC' | 'NGN')}>
              <option value="USDC">Crypto (USDC)</option>
              <option value="NGN">Bank (NGN)</option>
            </select>
          </div>

          {method === 'USDC' ? (
            <>
              <div className="row g-2 mt-2">
                <div className="col-12 col-md-4">
                  <label className="form-label">Amount (USD)</label>
                  <input className="form-control" value={amountUsd} onChange={(e) => setAmountUsd(e.target.value)} inputMode="decimal" />
                  <div className="text-muted small mt-1">Sent as USDC on the configured network.</div>
                </div>
                <div className="col-12 col-md-8">
                  <label className="form-label">Destination address</label>
                  <input className="form-control font-monospace" value={address} onChange={(e) => setAddress(e.target.value)} />
                </div>
              </div>

              <div className="mt-2">
                <label className="form-label">Memo / Tag (optional)</label>
                <input className="form-control" value={memo} onChange={(e) => setMemo(e.target.value)} />
              </div>

              <div className="text-muted small mt-2">
                Submitting creates a withdrawal request. Finance submits the on-chain transfer via Circle and it completes automatically.
              </div>

              <button
                className="btn btn-primary w-100 mt-3"
                disabled={!token || busy || !usdCents || !address.trim()}
                type="button"
                onClick={() => {
                  if (!token || !usdCents) return
                  setBusy(true)
                  setError(null)
                  apiFetch<{ id: string; status: string }>('/api/consumer/withdrawals/usdc', {
                    method: 'POST',
                    token,
                    body: { usdCents, address: address.trim(), memo: memo.trim() || undefined },
                  })
                    .then(() => navigate('/activity'))
                    .catch((e: unknown) => {
                      const msg = e && typeof e === 'object' && 'error' in e ? String((e as { error: string }).error) : 'withdraw_failed'
                      setError(msg)
                    })
                    .finally(() => setBusy(false))
                }}
              >
                {busy ? 'Submitting…' : 'Submit withdrawal'}
              </button>
            </>
          ) : (
            <>
              <div className="row g-2 mt-2">
                <div className="col-12 col-md-4">
                  <label className="form-label">Amount (NGN)</label>
                  <input className="form-control" value={amountNgn} onChange={(e) => setAmountNgn(e.target.value)} inputMode="decimal" />
                  <div className="text-muted small mt-1">Manual bank payout after review.</div>
                </div>
                <div className="col-12 col-md-8">
                  <label className="form-label">Bank name</label>
                  <input className="form-control" value={bankName} onChange={(e) => setBankName(e.target.value)} />
                </div>
              </div>
              <div className="row g-2 mt-2">
                <div className="col-12 col-md-6">
                  <label className="form-label">Account name</label>
                  <input className="form-control" value={accountName} onChange={(e) => setAccountName(e.target.value)} />
                </div>
                <div className="col-12 col-md-6">
                  <label className="form-label">Account number</label>
                  <input className="form-control" value={accountNumber} onChange={(e) => setAccountNumber(e.target.value)} inputMode="numeric" />
                </div>
              </div>

              <div className="text-muted small mt-2">Submitting creates a withdrawal request. Finance reviews and pays out to your bank account.</div>

              <button
                className="btn btn-primary w-100 mt-3"
                disabled={!token || busy || !ngnAmount || !bankName.trim() || !accountName.trim() || !accountNumber.trim()}
                type="button"
                onClick={() => {
                  if (!token || !ngnAmount) return
                  setBusy(true)
                  setError(null)
                  apiFetch<{ id: string; status: string }>('/api/consumer/withdrawals/ngn', {
                    method: 'POST',
                    token,
                    body: { amount: ngnAmount, bankName: bankName.trim(), accountName: accountName.trim(), accountNumber: accountNumber.trim() },
                  })
                    .then(() => navigate('/activity'))
                    .catch((e: unknown) => {
                      const msg = e && typeof e === 'object' && 'error' in e ? String((e as { error: string }).error) : 'withdraw_failed'
                      setError(msg)
                    })
                    .finally(() => setBusy(false))
                }}
              >
                {busy ? 'Submitting…' : 'Submit withdrawal'}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
