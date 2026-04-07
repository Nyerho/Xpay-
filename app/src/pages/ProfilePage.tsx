export function ProfilePage() {
  return (
    <div className="container">
      <div className="h4 mb-3">Profile</div>
      <div className="card shadow-sm mb-3">
        <div className="card-body">
          <div className="d-flex justify-content-between">
            <div>
              <div className="fw-semibold">Chris</div>
              <div className="text-muted small">chris@example.com</div>
            </div>
            <span className="badge bg-success">Tier 1</span>
          </div>
          <hr />
          <div className="d-flex justify-content-between">
            <span className="text-muted">2FA</span>
            <span className="badge bg-success">Enabled</span>
          </div>
          <div className="d-flex justify-content-between mt-2">
            <span className="text-muted">Biometric login</span>
            <span className="badge bg-secondary">Off</span>
          </div>
        </div>
      </div>

      <div className="card shadow-sm">
        <div className="list-group list-group-flush">
          <button className="list-group-item list-group-item-action">Devices (Preview)</button>
          <button className="list-group-item list-group-item-action">Limits (Preview)</button>
          <button className="list-group-item list-group-item-action text-danger">Logout (Preview)</button>
        </div>
      </div>
    </div>
  )
}

