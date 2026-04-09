import { Link, NavLink, Outlet, useNavigate } from 'react-router-dom'
import { useAuth } from '../auth/useAuth'

function rolePill(role: string) {
  const cls =
    role === 'SUPERADMIN'
      ? 'bg-danger'
      : role === 'ADMIN'
        ? 'bg-primary'
        : role === 'FINANCE'
          ? 'bg-success'
          : 'bg-secondary'
  return <span className={`badge ${cls}`}>{role}</span>
}

export function AppLayout() {
  const { me, logout } = useAuth()
  const navigate = useNavigate()

  return (
    <div className="min-vh-100 bg-light">
      <nav className="navbar navbar-expand-lg navbar-dark" style={{ backgroundColor: '#0A3161' }}>
        <div className="container-fluid">
          <Link className="navbar-brand fw-bold" to="/">
            <span style={{ color: '#B31942' }}>x</span>
            <span style={{ color: '#FFFFFF' }}>pay</span>
            <span className="ms-2 small text-white-50">admin</span>
          </Link>
          <button
            className="navbar-toggler"
            type="button"
            data-bs-toggle="collapse"
            data-bs-target="#nav"
            aria-controls="nav"
            aria-expanded="false"
            aria-label="Toggle navigation"
          >
            <span className="navbar-toggler-icon"></span>
          </button>
          <div className="collapse navbar-collapse" id="nav">
            <ul className="navbar-nav me-auto mb-2 mb-lg-0">
              <li className="nav-item">
                <NavLink className="nav-link" to="/users">
                  Users
                </NavLink>
              </li>
              <li className="nav-item">
                <NavLink className="nav-link" to="/kyc">
                  KYC
                </NavLink>
              </li>
              <li className="nav-item">
                <NavLink className="nav-link" to="/gift-cards">
                  Gift Cards
                </NavLink>
              </li>
              <li className="nav-item">
                <NavLink className="nav-link" to="/inventory">
                  Inventory
                </NavLink>
              </li>
              <li className="nav-item">
                <NavLink className="nav-link" to="/transactions">
                  Transactions
                </NavLink>
              </li>
              <li className="nav-item">
                <NavLink className="nav-link" to="/promo-codes">
                  Promo Codes
                </NavLink>
              </li>
              <li className="nav-item">
                <NavLink className="nav-link" to="/settings">
                  Settings
                </NavLink>
              </li>
              <li className="nav-item">
                <NavLink className="nav-link" to="/audit">
                  Audit
                </NavLink>
              </li>
            </ul>
            <div className="d-flex align-items-center gap-3">
              <div className="text-white-50 small d-none d-md-block">{me?.email}</div>
              {me ? rolePill(me.role) : null}
              <button
                className="btn btn-outline-light btn-sm"
                onClick={() => {
                  logout()
                  navigate('/login')
                }}
              >
                Logout
              </button>
            </div>
          </div>
        </div>
      </nav>
      <main className="container-fluid py-3">
        <Outlet />
      </main>
    </div>
  )
}
