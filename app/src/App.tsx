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
import { SwapPage } from './pages/SwapPage'
import { WalletPage } from './pages/WalletPage'
import { DepositPage } from './pages/DepositPage'
import { SendPage } from './pages/SendPage'
import { ConvertPage } from './pages/ConvertPage'
import { NotificationsPage } from './pages/NotificationsPage'
import { LoadingAnimation } from './components/LoadingAnimation'

function TopBar() {
  return (
    <nav className="navbar navbar-dark xpay-topbar">
      <div className="container-fluid">
        <span className="navbar-brand fw-bold">
          <span className="xpay-logo-x">x</span>
          <span className="xpay-logo">pay</span>
        </span>
        <span className="badge xpay-badge">Live</span>
      </div>
    </nav>
  )
}

function BottomTabs() {
  return (
    <nav className="navbar navbar-dark xpay-bottom border-top fixed-bottom">
      <div className="container-fluid d-flex justify-content-around">
        <NavLink className={({ isActive }) => `nav-link small ${isActive ? 'active' : ''}`} to="/">
          Home
        </NavLink>
        <NavLink className={({ isActive }) => `nav-link small ${isActive ? 'active' : ''}`} to="/wallet">
          Wallet
        </NavLink>
        <NavLink className={({ isActive }) => `nav-link small ${isActive ? 'active' : ''}`} to="/activity">
          Activity
        </NavLink>
        <NavLink className={({ isActive }) => `nav-link small ${isActive ? 'active' : ''}`} to="/notifications">
          Alerts
        </NavLink>
        <NavLink className={({ isActive }) => `nav-link small ${isActive ? 'active' : ''}`} to="/profile">
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
        <LoadingAnimation label="Loading…" />
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
      <Route path="/swap" element={<SwapPage />} />
      <Route path="/cards" element={<CardsPage />} />
      <Route path="/bills" element={<BillsPage />} />
      <Route path="/deposit" element={<DepositPage />} />
      <Route path="/send" element={<SendPage />} />
      <Route path="/convert" element={<ConvertPage />} />
      <Route path="/wallet" element={<WalletPage />} />
      <Route path="/activity" element={<ActivityPage />} />
      <Route path="/notifications" element={<NotificationsPage />} />
      <Route path="/profile" element={<ProfilePage />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <div className="min-vh-100 xpay-bg pb-5" data-bs-theme="dark">
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
