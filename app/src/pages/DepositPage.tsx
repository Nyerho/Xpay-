import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { apiFetch } from '../api'
import { useAuth } from '../auth/useAuth'

type DepositInstructions = {
  bank?: {
    accountName?: string
    bankName?: string
    accountNumber?: string
    routingNumber?: string
    referenceFormat?: string
    supportEmail?: string
  }
  ngnBank?: {
    accountName?: string
    bankName?: string
    accountNumber?: string
    referenceFormat?: string
    supportEmail?: string
  }
  crypto?: {
    BTC?: { address: string; note?: string }
    ETH?: { address: string; note?: string }
    USDT?: { TRC20?: { address: string; note?: string }; ERC20?: { address: string; note?: string } }
  }
}

type CircleDepositAddresses = {
  provider: 'circle'
  asset: string
  addresses: Array<{ blockchain: string; address: string }>
}

type Rail = 'BANK' | 'BTC' | 'ETH' | 'TRC20' | 'ERC20'
type Asset = 'USD' | 'USDT' | 'BTC' | 'ETH'

export function DepositPage() {
  const { token } = useAuth()
  const navigate = useNavigate()
  const [tab, setTab] = useState<'crypto' | 'bank' | 'naira'>('crypto')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [cfg, setCfg] = useState<DepositInstructions | null>(null)
  const [circle, setCircle] = useState<CircleDepositAddresses | null>(null)
  const [circleLoading, setCircleLoading] = useState(false)
  const [circleError, setCircleError] = useState<string | null>(null)

  const [asset, setAsset] = useState<Asset>('USDT')
  const [rail, setRail] = useState<Rail>('TRC20')
  const [amount, setAmount] = useState('')
  const [txid, setTxid] = useState('')
  const [reference, setReference] = useState('')
  const [busy, setBusy] = useState(false)
  const [ngnBusy, setNgnBusy] = useState(false)
  const [ngnAmount, setNgnAmount] = useState('')
  const [ngnRef, setNgnRef] = useState<string | null>(null)

  useEffect(() => {
    setLoading(true)
    setError(null)
    apiFetch<{ valueJson: string }>('/api/public/deposit-instructions')
      .then((r) => {
        const parsed = JSON.parse(r.valueJson || '{}') as DepositInstructions
        setCfg(parsed)
      })
      .catch((e: unknown) => {
        const msg = e && typeof e === 'object' && 'error' in e ? String((e as { error: string }).error) : 'load_failed'
        setError(msg)
      })
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    if (!token) return
    setCircleLoading(true)
    setCircleError(null)
    apiFetch<CircleDepositAddresses>('/api/consumer/deposit-addresses', { token })
      .then((r) => setCircle(r))
      .catch((e: unknown) => {
        const msg = e && typeof e === 'object' && 'error' in e ? String((e as { error: string }).error) : 'circle_unavailable'
        setCircle(null)
        setCircleError(msg)
      })
      .finally(() => setCircleLoading(false))
  }, [token])

  const address = useMemo(() => {
    if (!cfg?.crypto) return null
    if (asset === 'BTC') return cfg.crypto.BTC?.address ?? null
    if (asset === 'ETH') return cfg.crypto.ETH?.address ?? null
    if (asset === 'USDT') {
      if (rail === 'TRC20') return cfg.crypto.USDT?.TRC20?.address ?? null
      if (rail === 'ERC20') return cfg.crypto.USDT?.ERC20?.address ?? null
    }
    return null
  }, [asset, cfg?.crypto, rail])

  const bank = cfg?.bank ?? null
  const ngnBank = cfg?.ngnBank ?? null

  return (
    <div className="container xpay-fade-in" style={{ maxWidth: 760 }}>
      <div className="d-flex align-items-center justify-content-between mb-3">
        <div className="h4 mb-0">Deposit</div>
        <button className="btn btn-sm btn-outline-light" type="button" onClick={() => navigate('/wallet')}>
          Wallet
        </button>
      </div>

      {error ? <div className="alert alert-danger py-2">{error}</div> : null}

      <ul className="nav nav-pills mb-3">
        <li className="nav-item">
          <button className={`nav-link ${tab === 'crypto' ? 'active' : ''}`} type="button" onClick={() => setTab('crypto')}>
            Crypto
          </button>
        </li>
        <li className="nav-item">
          <button className={`nav-link ${tab === 'bank' ? 'active' : ''}`} type="button" onClick={() => setTab('bank')}>
            Bank
          </button>
        </li>
        <li className="nav-item">
          <button className={`nav-link ${tab === 'naira' ? 'active' : ''}`} type="button" onClick={() => setTab('naira')}>
            Naira
          </button>
        </li>
      </ul>

      {tab === 'crypto' ? (
        <div className="card xpay-card shadow-sm">
          <div className="card-body">
            {circleError ? <div className="alert alert-secondary py-2 mb-3">Circle: {circleError}</div> : null}
            {circle ? (
              <>
                <div className="fw-semibold mb-2">{circle.asset} deposit addresses</div>
                {circle.addresses.map((a) => (
                  <div key={a.blockchain} className="mb-3">
                    <div className="text-muted small mb-1">{a.blockchain}</div>
                    <div className="input-group">
                      <input className="form-control font-monospace" readOnly value={a.address} />
                      <button
                        className="btn btn-outline-light"
                        type="button"
                        onClick={() => {
                          void navigator.clipboard.writeText(a.address)
                        }}
                      >
                        Copy
                      </button>
                    </div>
                  </div>
                ))}
                <div className="text-muted small">
                  Deposits are credited automatically after confirmation. If you don’t see an address, contact support.
                </div>
              </>
            ) : (
              <>
                <div className="row g-2">
                  <div className="col-6">
                    <label className="form-label">Asset</label>
                    <select className="form-select" value={asset} onChange={(e) => setAsset(e.target.value as Asset)}>
                      <option value="USDT">USDT</option>
                      <option value="BTC">BTC</option>
                      <option value="ETH">ETH</option>
                    </select>
                  </div>
                  <div className="col-6">
                    <label className="form-label">Network</label>
                    <select
                      className="form-select"
                      value={rail}
                      onChange={(e) => setRail(e.target.value as Rail)}
                      disabled={asset === 'BTC' || asset === 'ETH'}
                    >
                      {asset === 'USDT' ? (
                        <>
                          <option value="TRC20">TRC20</option>
                          <option value="ERC20">ERC20</option>
                        </>
                      ) : asset === 'BTC' ? (
                        <option value="BTC">Bitcoin</option>
                      ) : (
                        <option value="ETH">Ethereum</option>
                      )}
                    </select>
                  </div>
                </div>

                <div className="mt-3">
                  <label className="form-label">Deposit address</label>
                  <div className="input-group">
                    <input
                      className="form-control font-monospace"
                      readOnly
                      value={address ?? ''}
                      placeholder={loading || circleLoading ? 'Loading…' : 'Not configured'}
                    />
                    <button
                      className="btn btn-outline-light"
                      type="button"
                      disabled={!address}
                      onClick={() => {
                        if (!address) return
                        void navigator.clipboard.writeText(address)
                      }}
                    >
                      Copy
                    </button>
                  </div>
                  <div className="text-muted small mt-2">
                    Send only {asset} on the selected network. If deposit details are missing, configure them in Admin → Settings → depositInstructions.
                  </div>
                </div>

                <hr className="border-secondary" />

                <div className="fw-semibold mb-2">Submit deposit for credit</div>
                <div className="row g-2">
                  <div className="col-12 col-md-4">
                    <label className="form-label">Amount</label>
                    <input className="form-control" value={amount} onChange={(e) => setAmount(e.target.value)} inputMode="decimal" />
                  </div>
                  <div className="col-12 col-md-8">
                    <label className="form-label">Transaction hash</label>
                    <input className="form-control font-monospace" value={txid} onChange={(e) => setTxid(e.target.value)} placeholder="Paste tx hash" />
                  </div>
                </div>

                <button
                  className="btn btn-primary w-100 mt-3"
                  disabled={!token || busy || !address || !amount.trim() || !txid.trim()}
                  type="button"
                  onClick={() => {
                    if (!token) return
                    setBusy(true)
                    setError(null)
                    apiFetch<{ id: string; status: string }>('/api/consumer/deposits', {
                      method: 'POST',
                      token,
                      body: { asset, rail: asset === 'BTC' ? 'BTC' : asset === 'ETH' ? 'ETH' : rail, amount: amount.trim(), txid: txid.trim() },
                    })
                      .then(() => navigate('/activity'))
                      .catch((e: unknown) => {
                        const msg = e && typeof e === 'object' && 'error' in e ? String((e as { error: string }).error) : 'deposit_failed'
                        setError(msg)
                      })
                      .finally(() => setBusy(false))
                  }}
                >
                  {busy ? 'Submitting…' : 'Submit deposit'}
                </button>
              </>
            )}
          </div>
        </div>
      ) : tab === 'bank' ? (
        <div className="card xpay-card shadow-sm">
          <div className="card-body">
            <div className="fw-semibold mb-2">Bank transfer details</div>
            <div className="row g-2">
              <div className="col-12 col-md-6">
                <div className="text-muted small">Account name</div>
                <div className="fw-semibold">{bank?.accountName ?? 'Not configured'}</div>
              </div>
              <div className="col-12 col-md-6">
                <div className="text-muted small">Bank</div>
                <div className="fw-semibold">{bank?.bankName ?? 'Not configured'}</div>
              </div>
              <div className="col-12 col-md-6">
                <div className="text-muted small">Account number</div>
                <div className="fw-semibold">{bank?.accountNumber ?? 'Not configured'}</div>
              </div>
              <div className="col-12 col-md-6">
                <div className="text-muted small">Routing number</div>
                <div className="fw-semibold">{bank?.routingNumber ?? 'Not configured'}</div>
              </div>
            </div>

            <div className="text-muted small mt-3">
              Use your reference when sending a transfer. Configure these fields in Admin → Settings → depositInstructions.
            </div>

            <hr className="border-secondary" />

            <div className="fw-semibold mb-2">Submit transfer for credit</div>
            <div className="row g-2">
              <div className="col-12 col-md-6">
                <label className="form-label">Amount (USD)</label>
                <input className="form-control" value={amount} onChange={(e) => setAmount(e.target.value)} inputMode="decimal" />
              </div>
              <div className="col-12 col-md-6">
                <label className="form-label">Reference</label>
                <input className="form-control" value={reference} onChange={(e) => setReference(e.target.value)} placeholder={bank?.referenceFormat ?? 'Your user reference'} />
              </div>
            </div>

            <button
              className="btn btn-primary w-100 mt-3"
              disabled={!token || busy || !amount.trim() || !reference.trim()}
              type="button"
              onClick={() => {
                if (!token) return
                setBusy(true)
                setError(null)
                apiFetch<{ id: string; status: string }>('/api/consumer/deposits', {
                  method: 'POST',
                  token,
                  body: { asset: 'USD', rail: 'BANK', amount: amount.trim(), reference: reference.trim() },
                })
                  .then(() => navigate('/activity'))
                  .catch((e: unknown) => {
                    const msg = e && typeof e === 'object' && 'error' in e ? String((e as { error: string }).error) : 'deposit_failed'
                    setError(msg)
                  })
                  .finally(() => setBusy(false))
              }}
            >
              {busy ? 'Submitting…' : 'Submit transfer'}
            </button>
          </div>
        </div>
      ) : (
        <div className="card xpay-card shadow-sm">
          <div className="card-body">
            <div className="fw-semibold mb-2">NGN bank transfer</div>
            <div className="row g-2">
              <div className="col-12 col-md-6">
                <div className="text-muted small">Bank</div>
                <div className="fw-semibold">{ngnBank?.bankName ?? 'Not configured'}</div>
              </div>
              <div className="col-12 col-md-6">
                <div className="text-muted small">Account name</div>
                <div className="fw-semibold">{ngnBank?.accountName ?? '—'}</div>
              </div>
              <div className="col-12 col-md-6">
                <div className="text-muted small">Account number</div>
                <div className="fw-semibold">{ngnBank?.accountNumber ?? '—'}</div>
              </div>
              <div className="col-12 col-md-6">
                <div className="text-muted small">Support</div>
                <div className="fw-semibold">{ngnBank?.supportEmail ?? bank?.supportEmail ?? '—'}</div>
              </div>
            </div>

            <hr className="border-secondary" />

            <div className="fw-semibold mb-2">Create a deposit reference</div>
            <div className="row g-2">
              <div className="col-12 col-md-6">
                <label className="form-label">Amount (NGN)</label>
                <input className="form-control" value={ngnAmount} onChange={(e) => setNgnAmount(e.target.value)} inputMode="decimal" />
              </div>
              <div className="col-12 col-md-6">
                <label className="form-label">Reference</label>
                <div className="input-group">
                  <input className="form-control font-monospace" readOnly value={ngnRef ?? ''} placeholder="Create a reference first" />
                  <button
                    className="btn btn-outline-light"
                    type="button"
                    disabled={!ngnRef}
                    onClick={() => {
                      if (!ngnRef) return
                      void navigator.clipboard.writeText(ngnRef)
                    }}
                  >
                    Copy
                  </button>
                </div>
              </div>
            </div>

            <button
              className="btn btn-primary w-100 mt-3"
              disabled={!token || ngnBusy || !ngnAmount.trim()}
              type="button"
              onClick={() => {
                if (!token) return
                setNgnBusy(true)
                setError(null)
                setNgnRef(null)
                apiFetch<{ id: string; status: string; reference: string }>('/api/consumer/deposits/ngn', {
                  method: 'POST',
                  token,
                  body: { amount: ngnAmount.trim() },
                })
                  .then((r) => {
                    setNgnRef(r.reference)
                  })
                  .catch((e: unknown) => {
                    const msg = e && typeof e === 'object' && 'error' in e ? String((e as { error: string }).error) : 'deposit_failed'
                    setError(msg)
                  })
                  .finally(() => setNgnBusy(false))
              }}
            >
              {ngnBusy ? 'Creating…' : 'Create reference'}
            </button>

            <div className="text-muted small mt-2">
              Make the bank transfer and include the reference exactly. Your deposit will be credited after review.
            </div>

            <button className="btn btn-outline-light w-100 mt-3" type="button" onClick={() => navigate('/activity')}>
              View activity
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
