import { useEffect, useState } from 'react'
import { apiFetch } from '../api'
import { useAuth } from '../auth/useAuth'
import { formatDate } from '../utils'

type Row = {
  id: string
  createdAt: string
  actorEmail: string | null
  action: string
  entity: string
  entityId: string | null
  ip: string | null
}

export function AuditPage() {
  const { token } = useAuth()
  const [rows, setRows] = useState<Row[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function load() {
    if (!token) return
    setLoading(true)
    setError(null)
    apiFetch<Row[]>('/api/admin/audit', { token })
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
      <div className="d-flex align-items-center justify-content-between mb-3">
        <div className="h4 mb-0">Audit Log</div>
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
                <th>When</th>
                <th>Actor</th>
                <th>Action</th>
                <th>Entity</th>
                <th>EntityId</th>
                <th>IP</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id}>
                  <td className="small text-muted">{formatDate(r.createdAt)}</td>
                  <td className="small">{r.actorEmail ?? ''}</td>
                  <td className="small font-monospace">{r.action}</td>
                  <td className="small">{r.entity}</td>
                  <td className="small font-monospace">{r.entityId ?? ''}</td>
                  <td className="small font-monospace">{r.ip ?? ''}</td>
                </tr>
              ))}
              {rows.length === 0 && !loading ? (
                <tr>
                  <td colSpan={6} className="text-center text-muted py-4">
                    No audit events
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
