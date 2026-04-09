import { useEffect, useState } from 'react'
import { apiFetch } from '../api'
import { useAuth } from '../auth/useAuth'
import { formatCents, formatDate } from '../utils'

type Row = {
  id: string
  userId: string
  userEmail: string
  type: string
  status: string
  asset: string | null
  amountUsdCents: number | null
  createdAt: string
}

export function TransactionsPage() {
  const { token, me } = useAuth()
  const [q, setQ] = useState('')
  const [rows, setRows] = useState<Row[]>([])
  const [loading, setLoading] = useState(false)
  const [settlingId, setSettlingId] = useState<string | null>(null)
  const [retryingId, setRetryingId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const canSettle = me?.role === 'FINANCE' || me?.role === 'ADMIN' || me?.role === 'SUPERADMIN'

  function load() {
    if (!token) return
    setLoading(true)
    setError(null)
    apiFetch<Row[]>('/api/admin/transactions' + (q.trim() ? `?q=${encodeURIComponent(q.trim())}` : ''), { token })
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

  return (
    <div className="container-fluid">
      <div className="d-flex flex-wrap gap-2 align-items-center justify-content-between mb-3">
        <div className="h4 mb-0">Transactions</div>
        <div className="d-flex gap-2">
          <input
            className="form-control"
            style={{ width: 320 }}
            placeholder="Search tx id, email, asset…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
          <button className="btn btn-outline-primary" onClick={() => load()} disabled={loading}>
            Search
          </button>
        </div>
      </div>

      {error ? <div className="alert alert-danger py-2">{error}</div> : null}

      <div className="card shadow-sm">
        <div className="table-responsive">
          <table className="table table-sm table-striped mb-0 align-middle">
            <thead className="table-light">
              <tr>
                <th>Tx</th>
                <th>User</th>
                <th>Type</th>
                <th>Status</th>
                <th>Asset</th>
                <th>USD</th>
                <th>Created</th>
                <th style={{ width: 160 }}>Action</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id}>
                  <td className="font-monospace small">{r.id}</td>
                  <td className="small">{r.userEmail}</td>
                  <td className="small">{r.type}</td>
                  <td>
                    <span className={`badge ${r.status === 'COMPLETE' ? 'bg-success' : r.status === 'FAILED' ? 'bg-danger' : 'bg-secondary'}`}>
                      {r.status}
                    </span>
                  </td>
                  <td className="small">{r.asset ?? ''}</td>
                  <td className="small text-muted">{formatCents(r.amountUsdCents)}</td>
                  <td className="small text-muted">{formatDate(r.createdAt)}</td>
                  <td>
                    {canSettle && (r.type === 'DEPOSIT' || r.type === 'WITHDRAWAL') && r.status === 'PENDING' ? (
                      <button
                        className="btn btn-sm btn-primary"
                        disabled={!token || settlingId === r.id}
                        onClick={() => {
                          if (!token) return
                          setSettlingId(r.id)
                          setError(null)
                          apiFetch<{ ok: true }>(`/api/admin/transactions/${r.id}/settle`, { method: 'POST', token })
                            .then(() => load())
                            .catch((e: unknown) => {
                              const msg =
                                e && typeof e === 'object' && 'error' in e ? String((e as { error: string }).error) : 'settle_failed'
                              setError(msg)
                            })
                            .finally(() => setSettlingId(null))
                        }}
                      >
                        Settle
                      </button>
                    ) : null}

                    {canSettle && r.type === 'WITHDRAWAL' && r.status === 'FAILED' && r.asset === 'NGN:PAYSTACK_TRANSFER' ? (
                      <button
                        className="btn btn-sm btn-outline-warning ms-2"
                        disabled={!token || retryingId === r.id}
                        onClick={() => {
                          if (!token) return
                          setRetryingId(r.id)
                          setError(null)
                          apiFetch<{ ok: true }>(`/api/admin/transactions/${r.id}/retry-payout`, { method: 'POST', token })
                            .then(() => load())
                            .catch((e: unknown) => {
                              const msg =
                                e && typeof e === 'object' && 'error' in e ? String((e as { error: string }).error) : 'retry_failed'
                              setError(msg)
                            })
                            .finally(() => setRetryingId(null))
                        }}
                      >
                        Retry
                      </button>
                    ) : null}
                  </td>
                </tr>
              ))}
              {rows.length === 0 && !loading ? (
                <tr>
                  <td colSpan={8} className="text-center text-muted py-4">
                    No transactions
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
