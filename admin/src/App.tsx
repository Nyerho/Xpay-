import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { AuthProvider } from './auth/AuthProvider'
import { useAuth } from './auth/useAuth'
import { AppLayout } from './layout/AppLayout'
import { AuditPage } from './pages/AuditPage'
import { DashboardPage } from './pages/DashboardPage'
import { GiftCardsPage } from './pages/GiftCardsPage'
import { InventoryPage } from './pages/InventoryPage'
import { KycPage } from './pages/KycPage'
import { LoginPage } from './pages/LoginPage'
import { SettingsPage } from './pages/SettingsPage'
import { TransactionsPage } from './pages/TransactionsPage'
import { UsersPage } from './pages/UsersPage'

function AuthedApp() {
  const { status } = useAuth()

  if (status === 'loading') {
    return (
      <div className="container py-5">
        <div className="text-muted">Loading…</div>
      </div>
    )
  }

  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route
        path="/*"
        element={
          status === 'authed' ? (
            <AppLayout />
          ) : (
            <Navigate to="/login" replace />
          )
        }
      >
        <Route index element={<DashboardPage />} />
        <Route path="users" element={<UsersPage />} />
        <Route path="kyc" element={<KycPage />} />
        <Route path="gift-cards" element={<GiftCardsPage />} />
        <Route path="inventory" element={<InventoryPage />} />
        <Route path="transactions" element={<TransactionsPage />} />
        <Route path="settings" element={<SettingsPage />} />
        <Route path="audit" element={<AuditPage />} />
      </Route>
    </Routes>
  )
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <AuthedApp />
      </BrowserRouter>
    </AuthProvider>
  )
}
