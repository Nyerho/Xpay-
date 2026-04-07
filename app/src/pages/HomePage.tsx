import { Link } from 'react-router-dom'

function ActionButton(props: { to: string; label: string; variant: string }) {
  return (
    <div className="col-6">
      <Link to={props.to} className={`btn ${props.variant} w-100 py-3 fw-semibold`}>
        {props.label}
      </Link>
    </div>
  )
}

export function HomePage() {
  return (
    <div className="container">
      <div className="card shadow-sm mb-3">
        <div className="card-body">
          <div className="d-flex justify-content-between align-items-start">
            <div>
              <div className="text-muted small">USD Balance</div>
              <div className="h2 mb-0">$1,248.20</div>
              <div className="text-muted small">Fiat + USDT spending power</div>
            </div>
            <span className="badge bg-success">Verified</span>
          </div>
        </div>
      </div>

      <div className="row g-2 mb-3">
        <ActionButton to="/buy" label="Buy" variant="btn-primary" />
        <ActionButton to="/sell" label="Sell" variant="btn-outline-primary" />
        <ActionButton to="/cards" label="Cards" variant="btn-outline-dark" />
        <ActionButton to="/bills" label="Pay Bills" variant="btn-danger" />
      </div>

      <div className="card shadow-sm">
        <div className="card-body">
          <div className="fw-bold mb-2">Quick Status</div>
          <div className="d-flex flex-column gap-2">
            <div className="d-flex justify-content-between">
              <span className="text-muted">Last trade</span>
              <span>BTC → USD</span>
            </div>
            <div className="d-flex justify-content-between">
              <span className="text-muted">Gift card review</span>
              <span className="badge bg-secondary">None</span>
            </div>
            <div className="d-flex justify-content-between">
              <span className="text-muted">Bill pay</span>
              <span className="badge bg-success">Ready</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

