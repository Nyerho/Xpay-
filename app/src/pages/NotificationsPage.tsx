import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { apiFetch } from '../api'
import { useAuth } from '../auth/useAuth'

type NotificationRow = {
  id: string
  type: string
  title: string
  body: string
  link: string | null
  isRead: boolean
  createdAt: string
}

function formatWhen(iso: string) {
  const d = new Date(iso)
  return d.toLocaleString()
}

export function NotificationsPage() {
  const { token } = useAuth()
  const navigate = useNavigate()
  const [rows, setRows] = useState<NotificationRow[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!token) return
    setLoading(true)
    setError(null)
    apiFetch<NotificationRow[]>('/api/consumer/notifications', { token })
      .then(setRows)
      .catch((e: unknown) => {
        const msg = e && typeof e === 'object' && 'error' in e ? String((e as { error: string }).error) : 'load_failed'
        setError(msg)
      })
      .finally(() => setLoading(false))
  }, [token])

  return (
    <div className="container xpay-fade-in" style={{ maxWidth: 760 }}>
      <div className="d-flex align-items-center justify-content-between mb-3">
        <div className="h4 mb-0">Notifications</div>
        <button className="btn btn-sm btn-outline-light" type="button" onClick={() => navigate('/wallet')}>
          Wallet
        </button>
      </div>

      {error ? <div className="alert alert-danger py-2">{error}</div> : null}

      <div className="card xpay-card shadow-sm">
        <div className="list-group list-group-flush">
          {loading ? <div className="list-group-item text-muted">Loading…</div> : null}
          {!loading && rows.length === 0 ? <div className="list-group-item text-muted">No notifications yet</div> : null}
          {rows.map((n) => (
            <button
              key={n.id}
              type="button"
              className="list-group-item list-group-item-action"
              onClick={() => {
                if (!token) return
                apiFetch<{ ok: true }>(`/api/consumer/notifications/${n.id}/read`, { method: 'POST', token })
                  .catch(() => {})
                  .finally(() => {
                    if (n.link) navigate(n.link)
                  })
              }}
            >
              <div className="d-flex justify-content-between align-items-start">
                <div>
                  <div className="fw-semibold">
                    {n.title} {!n.isRead ? <span className="badge bg-primary ms-2">New</span> : null}
                  </div>
                  <div className="text-muted small">{n.body}</div>
                  <div className="text-muted small mt-1">{formatWhen(n.createdAt)}</div>
                </div>
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}

