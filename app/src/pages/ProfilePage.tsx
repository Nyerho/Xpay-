import { useAuth } from '../auth/useAuth'

export function ProfilePage() {
  const { me, logout } = useAuth()
  return (
    <div className="container xpay-fade-in">
      <div className="h4 mb-3">Profile</div>
      <div className="card xpay-card shadow-sm mb-3">
        <div className="card-body">
          <div className="d-flex justify-content-between">
            <div>
              <div className="fw-semibold">{me?.email}</div>
              <div className="text-muted small">{me?.phone ?? ''}</div>
            </div>
            <span className="badge bg-secondary">Consumer</span>
          </div>
          <hr />
          <div className="d-flex justify-content-between">
            <span className="text-muted">2FA</span>
            <span className={`badge ${me?.mfaEnabled ? 'bg-success' : 'bg-secondary'}`}>{me?.mfaEnabled ? 'Enabled' : 'Off'}</span>
          </div>
        </div>
      </div>

      <div className="card xpay-card shadow-sm">
        <div className="list-group list-group-flush">
          <button className="list-group-item list-group-item-action" type="button">
            Devices
          </button>
          <button className="list-group-item list-group-item-action" type="button">
            Limits
          </button>
          <button
            className="list-group-item list-group-item-action text-danger"
            type="button"
            onClick={() => logout()}
          >
            Logout
          </button>
        </div>
      </div>
    </div>
  )
}
