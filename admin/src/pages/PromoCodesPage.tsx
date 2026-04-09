import { useEffect, useMemo, useState } from 'react'
import { apiFetch } from '../api'
import { useAuth } from '../auth/useAuth'
import { formatDate } from '../utils'

type Promo = {
  id: string
  code: string
  ngnBonusKobo: number
  maxRedemptions: number | null
  redeemedCount: number
  isActive: boolean
  expiresAt: string | null
  createdAt: string
}

export function PromoCodesPage() {
  const { token } = useAuth()
  const [rows, setRows] = useState<Promo[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [code, setCode] = useState('')
  const [ngnBonus, setNgnBonus] = useState('100.00')
  const [maxRedemptions, setMaxRedemptions] = useState('')
  const [expiresAt, setExpiresAt] = useState('')
  const [busy, setBusy] = useState(false)

  const ngnBonusKobo = useMemo(() => {
    const m = ngnBonus.trim().match(/^(\d+)(?:\.(\d{0,2}))?$/)
    if (!m) return null
    const whole = Number(m[1] ?? '0')
    const frac = String(m[2] ?? '').padEnd(2, '0')
    const kobo = whole * 100 + Number(frac || '0')
    return Number.isFinite(kobo) && kobo >= 0 ? kobo : null
  }, [ngnBonus])

  const load = () => {
    if (!token) return
    setLoading(true)
    setError(null)
    apiFetch<Promo[]>('/api/admin/promo-codes', { token })
      .then(setRows)
      .catch((e: unknown) => {
        const msg = e && typeof e === 'object' && 'error' in e ? String((e as { error: string }).error) : 'load_failed'
        setError(msg)
      })
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    load()
  }, [token])

  return (
    <div className="container-fluid">
      <div className="d-flex align-items-center justify-content-between mb-3">
        <div>
          <div className="h4 mb-0">Promo Codes</div>
          <div className="text-muted small">Create signup promo codes that apply on first successful NGN deposit.</div>
        </div>
        <button className="btn btn-outline-secondary btn-sm" type="button" onClick={load} disabled={!token || loading}>
          Refresh
        </button>
      </div>

      {error ? <div className="alert alert-danger py-2">{error}</div> : null}

      <div className="card mb-3">
        <div className="card-body">
          <div className="row g-2 align-items-end">
            <div className="col-12 col-md-3">
              <label className="form-label">Code</label>
              <input className="form-control" value={code} onChange={(e) => setCode(e.target.value)} placeholder="WELCOME100" />
            </div>
            <div className="col-12 col-md-3">
              <label className="form-label">NGN bonus</label>
              <input className="form-control" value={ngnBonus} onChange={(e) => setNgnBonus(e.target.value)} inputMode="decimal" />
            </div>
            <div className="col-12 col-md-3">
              <label className="form-label">Max redemptions (optional)</label>
              <input className="form-control" value={maxRedemptions} onChange={(e) => setMaxRedemptions(e.target.value)} inputMode="numeric" />
            </div>
            <div className="col-12 col-md-3">
              <label className="form-label">Expires at (optional ISO)</label>
              <input className="form-control" value={expiresAt} onChange={(e) => setExpiresAt(e.target.value)} placeholder="2026-12-31T00:00:00Z" />
            </div>
          </div>

          <button
            className="btn btn-primary mt-3"
            type="button"
            disabled={!token || busy || !code.trim() || ngnBonusKobo === null}
            onClick={() => {
              if (!token || ngnBonusKobo === null) return
              setBusy(true)
              setError(null)
              apiFetch<{ id: string }>('/api/admin/promo-codes', {
                method: 'POST',
                token,
                body: {
                  code: code.trim(),
                  ngnBonusKobo,
                  maxRedemptions: maxRedemptions.trim() ? Number(maxRedemptions.trim()) : undefined,
                  expiresAt: expiresAt.trim() || undefined,
                },
              })
                .then(() => {
                  setCode('')
                  setMaxRedemptions('')
                  setExpiresAt('')
                  load()
                })
                .catch((e: unknown) => {
                  const msg = e && typeof e === 'object' && 'error' in e ? String((e as { error: string }).error) : 'create_failed'
                  setError(msg)
                })
                .finally(() => setBusy(false))
            }}
          >
            {busy ? 'Creating…' : 'Create promo code'}
          </button>
        </div>
      </div>

      <div className="card">
        <div className="table-responsive">
          <table className="table table-sm mb-0">
            <thead>
              <tr>
                <th>Code</th>
                <th>Bonus</th>
                <th>Redeemed</th>
                <th>Active</th>
                <th>Expires</th>
                <th>Created</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id}>
                  <td className="fw-semibold">{r.code}</td>
                  <td>₦{(r.ngnBonusKobo / 100).toFixed(2)}</td>
                  <td>
                    {r.redeemedCount}
                    {r.maxRedemptions ? ` / ${r.maxRedemptions}` : ''}
                  </td>
                  <td>
                    <span className={`badge ${r.isActive ? 'bg-success' : 'bg-secondary'}`}>{r.isActive ? 'ON' : 'OFF'}</span>
                  </td>
                  <td className="text-muted small">{r.expiresAt ? formatDate(r.expiresAt) : '—'}</td>
                  <td className="text-muted small">{formatDate(r.createdAt)}</td>
                </tr>
              ))}
              {rows.length === 0 && !loading ? (
                <tr>
                  <td colSpan={6} className="text-center text-muted py-4">
                    No promo codes
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

