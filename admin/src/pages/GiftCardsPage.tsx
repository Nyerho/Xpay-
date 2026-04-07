import { useEffect, useState } from 'react'
import { apiFetch } from '../api'
import { useAuth } from '../auth/useAuth'
import { formatCents, formatDate } from '../utils'

type Row = {
  id: string
  userId: string
  userEmail: string
  brand: string
  valueUsdCents: number
  offerUsdtCents: number
  status: 'REVIEWING' | 'APPROVED' | 'REJECTED'
  createdAt: string
  reviewedById: string | null
  reviewNotes: string | null
  fraudFlagsJson: string
}

const statuses: Row['status'][] = ['REVIEWING', 'APPROVED', 'REJECTED']

export function GiftCardsPage() {
  const { token } = useAuth()
  const [rows, setRows] = useState<Row[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function load() {
    if (!token) return
    setLoading(true)
    setError(null)
    apiFetch<Row[]>('/api/admin/gift-cards', { token })
      .then(setRows)
      .catch((e: unknown) => {
        const msg = e && typeof e === 'object' && 'error' in e ? String((e as { error: string }).error) : 'load_failed'
        setError(msg)
      })
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    load()
  }, [])

  async function update(id: string, body: Partial<Pick<Row, 'status' | 'reviewNotes' | 'fraudFlagsJson'>>) {
    if (!token) return
    const current = rows.find((r) => r.id === id)
    if (!current) return
    await apiFetch<{ ok: true }>(`/api/admin/gift-cards/${id}`, {
      method: 'PATCH',
      token,
      body: {
        status: body.status ?? current.status,
        reviewNotes: body.reviewNotes === undefined ? current.reviewNotes : body.reviewNotes,
        fraudFlagsJson: body.fraudFlagsJson ?? current.fraudFlagsJson,
      },
    })
    load()
  }

  return (
    <div className="container-fluid">
      <div className="d-flex align-items-center justify-content-between mb-3">
        <div className="h4 mb-0">Gift Card Submissions</div>
        <button className="btn btn-outline-primary btn-sm" onClick={() => load()} disabled={loading}>
          Refresh
        </button>
      </div>

      {error ? <div className="alert alert-danger py-2">{error}</div> : null}

      <div className="card shadow-sm">
        <div className="table-responsive">
          <table className="table table-sm table-striped mb-0 align-middle">
            <thead className="table-light">
              <tr>
                <th>User</th>
                <th>Brand</th>
                <th>Value</th>
                <th>Offer</th>
                <th>Status</th>
                <th>Created</th>
                <th style={{ width: 520 }}>Review</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id}>
                  <td>
                    <div className="fw-semibold">{r.userEmail}</div>
                    <div className="text-muted small">{r.id}</div>
                  </td>
                  <td>{r.brand}</td>
                  <td className="text-muted">{formatCents(r.valueUsdCents)}</td>
                  <td className="text-muted">{(r.offerUsdtCents / 100).toFixed(2)} USDT</td>
                  <td>
                    <span className={`badge ${r.status === 'APPROVED' ? 'bg-success' : r.status === 'REJECTED' ? 'bg-danger' : 'bg-secondary'}`}>
                      {r.status}
                    </span>
                  </td>
                  <td className="text-muted small">{formatDate(r.createdAt)}</td>
                  <td>
                    <div className="d-flex flex-wrap gap-2">
                      <select
                        className="form-select form-select-sm"
                        style={{ width: 170 }}
                        value={r.status}
                        onChange={(e) => update(r.id, { status: e.target.value as Row['status'] })}
                      >
                        {statuses.map((s) => (
                          <option key={s} value={s}>
                            {s}
                          </option>
                        ))}
                      </select>
                      <input
                        className="form-control form-control-sm"
                        style={{ minWidth: 180 }}
                        placeholder="review notes"
                        value={r.reviewNotes ?? ''}
                        onChange={(e) => {
                          const v = e.target.value
                          setRows((prev) => prev.map((x) => (x.id === r.id ? { ...x, reviewNotes: v } : x)))
                        }}
                        onBlur={() => update(r.id, { reviewNotes: r.reviewNotes })}
                      />
                      <input
                        className="form-control form-control-sm font-monospace"
                        style={{ minWidth: 240 }}
                        placeholder='fraudFlagsJson, e.g. ["blur","duplicate"]'
                        value={r.fraudFlagsJson}
                        onChange={(e) => {
                          const v = e.target.value
                          setRows((prev) => prev.map((x) => (x.id === r.id ? { ...x, fraudFlagsJson: v } : x)))
                        }}
                        onBlur={() => update(r.id, { fraudFlagsJson: r.fraudFlagsJson })}
                      />
                    </div>
                  </td>
                </tr>
              ))}
              {rows.length === 0 && !loading ? (
                <tr>
                  <td colSpan={7} className="text-center text-muted py-4">
                    No submissions
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
