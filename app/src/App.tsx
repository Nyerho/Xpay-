import { BrowserRouter, Navigate, NavLink, Route, Routes } from 'react-router-dom'
import { AuthProvider } from './auth/AuthProvider'
import { useAuth } from './auth/useAuth'
import { ActivityPage } from './pages/ActivityPage'
import { BillsPage } from './pages/BillsPage'
import { BuyCryptoPage } from './pages/BuyCryptoPage'
import { CardsPage } from './pages/CardsPage'
import { HomePage } from './pages/HomePage'
import { LoginPage } from './pages/LoginPage'
import { ProfilePage } from './pages/ProfilePage'
import { SellCryptoPage } from './pages/SellCryptoPage'
import { WalletPage } from './pages/WalletPage'

function TopBar() {
  return (
    <nav className="navbar navbar-dark" style={{ backgroundColor: '#0A3161' }}>
      <div className="container-fluid">
        <span className="navbar-brand fw-bold">
          <span style={{ color: '#B31942' }}>x</span>
          <span style={{ color: '#FFFFFF' }}>pay</span>
        </span>
        <span className="badge bg-light text-dark">US MVP Preview</span>
      </div>
    </nav>
  )
}

function BottomTabs() {
  return (
    <nav className="navbar navbar-light bg-white border-top fixed-bottom">
      <div className="container-fluid d-flex justify-content-around">
        <NavLink className="nav-link small" to="/">
          Home
        </NavLink>
        <NavLink className="nav-link small" to="/wallet">
          Wallet
        </NavLink>
        <NavLink className="nav-link small" to="/activity">
          Activity
        </NavLink>
        <NavLink className="nav-link small" to="/profile">
          Profile
        </NavLink>
      </div>
    </nav>
  )
}

function AuthedRoutes() {
  const { status } = useAuth()
  if (status === 'loading') {
    return (
      <div className="container py-5">
        <div className="text-muted">Loading…</div>
      </div>
    )
  }
  if (status !== 'authed') {
    return <Navigate to="/login" replace />
  }
  return (
    <Routes>
      <Route path="/" element={<HomePage />} />
      <Route path="/buy" element={<BuyCryptoPage />} />
      <Route path="/sell" element={<SellCryptoPage />} />
      <Route path="/cards" element={<CardsPage />} />
      <Route path="/bills" element={<BillsPage />} />
      <Route path="/wallet" element={<WalletPage />} />
      <Route path="/activity" element={<ActivityPage />} />
      <Route path="/profile" element={<ProfilePage />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <div className="min-vh-100 bg-light pb-5">
          <TopBar />
          <main className="container py-3">
            <Routes>
              <Route path="/login" element={<LoginPage />} />
              <Route path="/*" element={<AuthedRoutes />} />
            </Routes>
          </main>
          <BottomTabs />
        </div>
      </BrowserRouter>
    </AuthProvider>
  )
}
