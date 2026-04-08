import { useEffect, useState } from 'react'
import { apiFetch } from '../api'
import { useAuth } from '../auth/useAuth'

type Row = {
  id: string
  type: string
  status: string
  asset: string | null
  amountUsdCents: number | null
  createdAt: string
}

function formatWhen(iso: string) {
  const d = new Date(iso)
  return d.toLocaleString()
}

export function ActivityPage() {
  const { token } = useAuth()
  const [rows, setRows] = useState<Row[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!token) return
    setLoading(true)
    setError(null)
    apiFetch<Row[]>('/api/consumer/transactions', { token })
      .then(setRows)
      .catch((e: unknown) => {
        const msg = e && typeof e === 'object' && 'error' in e ? String((e as { error: string }).error) : 'load_failed'
        setError(msg)
      })
      .finally(() => setLoading(false))
  }, [token])

  return (
    <div className="container xpay-fade-in">
      <div className="h4 mb-3">Activity</div>

      {error ? <div className="alert alert-danger py-2">{error}</div> : null}

      <div className="card xpay-card shadow-sm">
        <div className="list-group list-group-flush">
          {loading ? <div className="list-group-item text-muted">Loading…</div> : null}
          {!loading && rows.length === 0 ? <div className="list-group-item text-muted">No activity yet</div> : null}
          {rows.map((r) => (
            <div key={r.id} className="list-group-item d-flex justify-content-between align-items-center">
              <div>
                <div className="fw-semibold">{r.type}</div>
                <div className="text-muted small">
                  {r.asset ? `${r.asset} • ` : ''}
                  {formatWhen(r.createdAt)}
                </div>
              </div>
              <div className="text-end">
                <div className="fw-bold">
                  {r.amountUsdCents === null ? '' : `$${(r.amountUsdCents / 100).toFixed(2)}`}
                </div>
                <span
                  className={`badge ${
                    r.status === 'COMPLETE'
                      ? 'bg-success'
                      : r.status === 'PENDING'
                        ? 'bg-secondary'
                        : r.status === 'FAILED'
                          ? 'bg-danger'
                          : 'bg-warning text-dark'
                  }`}
                >
                  {r.status}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
