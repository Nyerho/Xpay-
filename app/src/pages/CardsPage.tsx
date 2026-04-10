import { useEffect, useMemo, useState } from 'react'
import { apiFetch } from '../api'
import { useAuth } from '../auth/useAuth'
import { uploadPublicFile } from '../firebase'
import { GiftCardRatesChart } from '../components/GiftCardRatesChart'

const brands = ['Amazon', 'iTunes', 'Google Play', 'Steam', 'Walmart', 'Visa', 'Amex', 'eBay'] as const
type Brand = (typeof brands)[number]

type Rate = { buyPct: number; sellPct: number }

type Submission = {
  id: string
  brand: string
  valueUsdCents: number
  offerUsdtCents: number
  status: 'REVIEWING' | 'APPROVED' | 'REJECTED'
  frontImageUrl: string | null
  backImageUrl: string | null
  createdAt: string
}

type InventoryRow = {
  brand: string
  valueUsdCents: number
  availableCount: number
}

type Purchase = {
  id: string
  brand: string
  valueUsdCents: number
  purchasedAt: string | null
}

export function CardsPage() {
  const { token } = useAuth()
  const [tab, setTab] = useState<'sell' | 'buy'>('sell')
  const [brand, setBrand] = useState<Brand>('Amazon')
  const [value, setValue] = useState('')
  const [rates, setRates] = useState<Record<string, Rate> | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [front, setFront] = useState<File | null>(null)
  const [back, setBack] = useState<File | null>(null)
  const [busy, setBusy] = useState(false)
  const [subs, setSubs] = useState<Submission[]>([])
  const [inv, setInv] = useState<InventoryRow[]>([])
  const [purchases, setPurchases] = useState<Purchase[]>([])
  const [buyBusy, setBuyBusy] = useState(false)
  const [lastCode, setLastCode] = useState<string | null>(null)
  const [revealed, setRevealed] = useState<Record<string, string>>({})

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

  useEffect(() => {
    if (!token) return
    apiFetch<Submission[]>('/api/consumer/gift-cards', { token })
      .then(setSubs)
      .catch(() => setSubs([]))
  }, [token])

  useEffect(() => {
    if (!token) return
    const key = brand.toUpperCase().replaceAll(' ', '_')
    apiFetch<InventoryRow[]>(`/api/consumer/gift-cards/inventory?brand=${encodeURIComponent(key)}`, { token })
      .then(setInv)
      .catch(() => setInv([]))
  }, [brand, token])

  useEffect(() => {
    if (!token) return
    apiFetch<Purchase[]>('/api/consumer/gift-cards/purchases', { token })
      .then(setPurchases)
      .catch(() => setPurchases([]))
  }, [token])

  const sellOffer = useMemo(() => {
    if (!rates) return null
    const v = Number(value || '0')
    const key = brand.toUpperCase().replaceAll(' ', '_')
    const rate = rates[key]
    if (!rate) return null
    return v * rate.buyPct
  }, [brand, rates, value])

  const valueUsdCents = useMemo(() => {
    const m = value.trim().match(/^(\d+)(?:\.(\d{0,2}))?$/)
    if (!m) return null
    const whole = Number(m[1] ?? '0')
    const frac = String(m[2] ?? '').padEnd(2, '0')
    const cents = whole * 100 + Number(frac || '0')
    return Number.isFinite(cents) && cents >= 100 ? cents : null
  }, [value])

  const buyPrice = useMemo(() => {
    if (!rates) return null
    const v = Number(value || '0')
    const key = brand.toUpperCase().replaceAll(' ', '_')
    const rate = rates[key]
    if (!rate) return null
    return v * rate.sellPct
  }, [brand, rates, value])

  const availableCount = useMemo(() => {
    if (!valueUsdCents) return 0
    const key = brand.toUpperCase().replaceAll(' ', '_')
    const row = inv.find((r) => r.brand === key && r.valueUsdCents === valueUsdCents)
    return row?.availableCount ?? 0
  }, [brand, inv, valueUsdCents])

  return (
    <div className="container xpay-fade-in">
      <div className="h4 mb-3">Gift Cards</div>
      <GiftCardRatesChart rates={rates} loading={loading} />

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

      <div className="card xpay-card shadow-sm">
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
                <div className="text-muted small mt-1">Upload card images and submit for review. If approved, your USDT balance is credited.</div>
              </div>
              <div className="row g-2">
                <div className="col-12 col-md-6">
                  <label className="form-label">Front image</label>
                  <input
                    className="form-control"
                    type="file"
                    accept="image/*"
                    onChange={(e) => setFront(e.target.files?.[0] ?? null)}
                  />
                </div>
                <div className="col-12 col-md-6">
                  <label className="form-label">Back image (optional)</label>
                  <input className="form-control" type="file" accept="image/*" onChange={(e) => setBack(e.target.files?.[0] ?? null)} />
                </div>
              </div>
              <button
                className="btn btn-primary w-100 mt-2"
                disabled={!token || busy || !front || !valueUsdCents || sellOffer === null}
                onClick={async () => {
                  if (!token || !front || !valueUsdCents) return
                  setBusy(true)
                  setError(null)
                  try {
                    const frontUrl = await uploadPublicFile({ folder: 'giftcards/front', file: front })
                    const backUrl = back ? await uploadPublicFile({ folder: 'giftcards/back', file: back }) : undefined
                    await apiFetch<{ id: string }>('/api/consumer/gift-cards', {
                      method: 'POST',
                      token,
                      body: { brand, valueUsdCents, frontImageUrl: frontUrl, backImageUrl: backUrl },
                    })
                    setFront(null)
                    setBack(null)
                    setValue('')
                    const next = await apiFetch<Submission[]>('/api/consumer/gift-cards', { token })
                    setSubs(next)
                  } catch (e: unknown) {
                    const msg = e && typeof e === 'object' && 'error' in e ? String((e as { error: string }).error) : 'submit_failed'
                    setError(msg)
                  } finally {
                    setBusy(false)
                  }
                }}
              >
                {busy ? 'Submitting…' : 'Submit for Review'}
              </button>

              <div className="mt-3">
                <div className="fw-semibold mb-2">My submissions</div>
                <div className="list-group list-group-flush">
                  {subs.length === 0 ? <div className="list-group-item text-muted">No submissions yet</div> : null}
                  {subs.map((s) => (
                    <div key={s.id} className="list-group-item d-flex justify-content-between align-items-center">
                      <div>
                        <div className="fw-semibold">{s.brand}</div>
                        <div className="text-muted small">${(s.valueUsdCents / 100).toFixed(2)} • {(s.offerUsdtCents / 100).toFixed(2)} USDT</div>
                      </div>
                      <span
                        className={`badge ${
                          s.status === 'APPROVED' ? 'bg-success' : s.status === 'REJECTED' ? 'bg-danger' : 'bg-secondary'
                        }`}
                      >
                        {s.status}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <div className="mt-3">
              <div className="alert alert-primary">
                Price:{' '}
                <span className="fw-bold">
                  {loading ? '—' : buyPrice === null ? '—' : `$${buyPrice.toFixed(2)}`}
                </span>
                <div className="text-muted small mt-1">
                  Available: <span className="fw-semibold">{availableCount}</span>
                </div>
              </div>
              {lastCode ? (
                <div className="alert alert-secondary">
                  <div className="fw-semibold">Your code</div>
                  <div className="d-flex gap-2 align-items-center mt-2">
                    <div className="font-monospace">{lastCode}</div>
                    <button
                      className="btn btn-sm btn-outline-light"
                      type="button"
                      onClick={() => {
                        void navigator.clipboard.writeText(lastCode)
                      }}
                    >
                      Copy
                    </button>
                  </div>
                </div>
              ) : null}
              <button
                className="btn btn-primary w-100"
                disabled={!token || buyBusy || !valueUsdCents || buyPrice === null || availableCount <= 0}
                onClick={async () => {
                  if (!token || !valueUsdCents) return
                  setBuyBusy(true)
                  setError(null)
                  setLastCode(null)
                  try {
                    const r = await apiFetch<{ ok: true; itemId: string }>('/api/consumer/gift-cards/buy', {
                      method: 'POST',
                      token,
                      body: { brand, valueUsdCents },
                    })
                    const reveal = await apiFetch<{ code: string }>(`/api/consumer/gift-cards/purchases/${r.itemId}/code`, { token })
                    setLastCode(reveal.code)
                    setRevealed((prev) => ({ ...prev, [r.itemId]: reveal.code }))
                    const nextInv = await apiFetch<InventoryRow[]>(`/api/consumer/gift-cards/inventory?brand=${encodeURIComponent(brand.toUpperCase().replaceAll(' ', '_'))}`, {
                      token,
                    })
                    setInv(nextInv)
                    const nextPurchases = await apiFetch<Purchase[]>('/api/consumer/gift-cards/purchases', { token })
                    setPurchases(nextPurchases)
                  } catch (e: unknown) {
                    const msg = e && typeof e === 'object' && 'error' in e ? String((e as { error: string }).error) : 'buy_failed'
                    setError(msg)
                  } finally {
                    setBuyBusy(false)
                  }
                }}
              >
                {buyBusy ? 'Buying…' : 'Buy Now'}
              </button>

              <div className="mt-3">
                <div className="fw-semibold mb-2">My purchases</div>
                <div className="list-group list-group-flush">
                  {purchases.length === 0 ? <div className="list-group-item text-muted">No purchases yet</div> : null}
                  {purchases.map((p) => (
                    <div key={p.id} className="list-group-item">
                      <div className="d-flex justify-content-between align-items-center">
                        <div>
                          <div className="fw-semibold">{p.brand}</div>
                          <div className="text-muted small">${(p.valueUsdCents / 100).toFixed(2)}</div>
                        </div>
                        <button
                          className="btn btn-sm btn-outline-light"
                          type="button"
                          onClick={() => {
                            const code = revealed[p.id]
                            if (code) {
                              void navigator.clipboard.writeText(code)
                              return
                            }
                            if (!token) return
                            apiFetch<{ code: string }>(`/api/consumer/gift-cards/purchases/${p.id}/code`, { token })
                              .then((r) => {
                                setRevealed((prev) => ({ ...prev, [p.id]: r.code }))
                              })
                              .catch(() => setError('reveal_failed'))
                          }}
                        >
                          {revealed[p.id] ? 'Copy code' : 'Reveal code'}
                        </button>
                      </div>
                      {revealed[p.id] ? <div className="font-monospace small mt-2">{revealed[p.id]}</div> : null}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
