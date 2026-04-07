import { Link } from 'react-router-dom'
import { useAuth } from '../auth/useAuth'

function Tile(props: { title: string; to: string; subtitle: string }) {
  return (
    <div className="col-12 col-md-6 col-xl-3">
      <Link to={props.to} className="text-decoration-none">
        <div className="card shadow-sm h-100">
          <div className="card-body">
            <div className="fw-bold">{props.title}</div>
            <div className="text-muted small">{props.subtitle}</div>
          </div>
        </div>
      </Link>
    </div>
  )
}

export function DashboardPage() {
  const { me } = useAuth()

  return (
    <div className="container-fluid">
      <div className="d-flex align-items-center justify-content-between mb-3">
        <div>
          <div className="h4 mb-0">Dashboard</div>
          <div className="text-muted small">{me?.email}</div>
        </div>
      </div>

      <div className="row g-3">
        <Tile title="Users" to="/users" subtitle="Search, freeze, roles, delete" />
        <Tile title="KYC" to="/kyc" subtitle="Review queue + decisions" />
        <Tile title="Gift Cards" to="/gift-cards" subtitle="Manual review queue" />
        <Tile title="Transactions" to="/transactions" subtitle="Search all activity" />
        <Tile title="Inventory" to="/inventory" subtitle="Gift card inventory CRUD" />
        <Tile title="Settings" to="/settings" subtitle="Spreads, gift card rates" />
        <Tile title="Audit" to="/audit" subtitle="Who did what" />
      </div>
    </div>
  )
}
