import { useEffect, useState } from 'react'
import { apiFetch } from '../api'
import { useAuth } from '../auth/useAuth'
import { formatDate } from '../utils'

type KycRow = {
  id: string
  userId: string
  userEmail: string
  status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'MANUAL_REVIEW'
  createdAt: string
  updatedAt: string
  reviewedById: string | null
  reviewNotes: string | null
}

const statuses: KycRow['status'][] = ['PENDING', 'APPROVED', 'REJECTED', 'MANUAL_REVIEW']

export function KycPage() {
  const { token } = useAuth()
  const [rows, setRows] = useState<KycRow[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function load() {
    if (!token) return
    setLoading(true)
    setError(null)
    apiFetch<KycRow[]>('/api/admin/kyc', { token })
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

  async function update(id: string, body: { status: KycRow['status']; reviewNotes?: string | null }) {
    if (!token) return
    await apiFetch<{ ok: true }>(`/api/admin/kyc/${id}`, { method: 'PATCH', token, body })
    load()
  }

  return (
    <div className="container-fluid">
      <div className="d-flex align-items-center justify-content-between mb-3">
        <div className="h4 mb-0">KYC Queue</div>
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
                <th>Status</th>
                <th>Created</th>
                <th>Updated</th>
                <th style={{ width: 380 }}>Decision</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id}>
                  <td>
                    <div className="fw-semibold">{r.userEmail}</div>
                    <div className="text-muted small">{r.id}</div>
                  </td>
                  <td>
                    <span className={`badge ${r.status === 'APPROVED' ? 'bg-success' : r.status === 'REJECTED' ? 'bg-danger' : 'bg-secondary'}`}>
                      {r.status}
                    </span>
                  </td>
                  <td className="text-muted small">{formatDate(r.createdAt)}</td>
                  <td className="text-muted small">{formatDate(r.updatedAt)}</td>
                  <td>
                    <div className="d-flex flex-wrap gap-2">
                      <select
                        className="form-select form-select-sm"
                        style={{ width: 170 }}
                        value={r.status}
                        onChange={(e) => update(r.id, { status: e.target.value as KycRow['status'], reviewNotes: r.reviewNotes })}
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
                        onBlur={() => update(r.id, { status: r.status, reviewNotes: r.reviewNotes })}
                      />
                    </div>
                  </td>
                </tr>
              ))}
              {rows.length === 0 && !loading ? (
                <tr>
                  <td colSpan={5} className="text-center text-muted py-4">
                    No KYC cases
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
