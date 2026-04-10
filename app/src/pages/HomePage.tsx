import { Link } from 'react-router-dom'
import { useEffect, useState } from 'react'
import { apiFetch } from '../api'
import { useAuth } from '../auth/useAuth'
import { TradingViewMarketOverview } from '../components/TradingViewMarketOverview'

function formatEth(wei: string) {
  try {
    const w = BigInt(wei)
    const scaled = w / 1000000000000n
    return (Number(scaled) / 1e6).toFixed(6)
  } catch {
    return null
  }
}

function ActionCard(props: { to: string; label: string; subtitle: string; variant: string; icon: React.ReactNode }) {
  return (
    <div className="col-6">
      <Link to={props.to} className="text-decoration-none">
        <div className={`card xpay-card xpay-action-card xpay-action-${props.variant} h-100`}>
          <div className="card-body">
            <div className="d-flex align-items-start gap-2">
              <div className="xpay-action-icon">{props.icon}</div>
              <div>
                <div className="fw-semibold">{props.label}</div>
                <div className="text-muted small">{props.subtitle}</div>
              </div>
            </div>
          </div>
        </div>
      </Link>
    </div>
  )
}

function IconBuy() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
      <path d="M12 4v16m0 0 6-6m-6 6-6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function IconSell() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
      <path d="M12 20V4m0 0 6 6m-6-6-6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function IconConvert() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
      <path d="M7 7h12l-3-3m3 3-3 3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M17 17H5l3 3m-3-3 3-3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function IconBills() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
      <path d="M7 3h10v18l-2-1-3 1-3-1-2 1V3Z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
      <path d="M9 8h6M9 12h6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  )
}

function IconDeposit() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
      <path d="M4 10h16v10H4V10Z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
      <path d="M7 10V7a5 5 0 0 1 10 0v3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <path d="M12 14v3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  )
}

function IconCards() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
      <path d="M3 8h18v10H3V8Z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
      <path d="M3 12h18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <path d="M7 16h3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  )
}

export function HomePage() {
  const { token } = useAuth()
  const [balance, setBalance] = useState<{ usdCents: number; ngnKobo: number; usdtCents: number; btcSats: number; ethWei: string } | null>(null)
  const [kycStatus, setKycStatus] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!token) return
    setLoading(true)
    setError(null)
    Promise.all([
      apiFetch<{ usdCents: number; ngnKobo: number; usdtCents: number; btcSats: number; ethWei: string }>('/api/consumer/balance', { token }),
      apiFetch<{ status: string }>('/api/consumer/kyc', { token }),
    ])
      .then(([b, k]) => {
        setBalance(b)
        setKycStatus(k.status)
      })
      .catch((e: unknown) => {
        const msg = e && typeof e === 'object' && 'error' in e ? String((e as { error: string }).error) : 'load_failed'
        setError(msg)
      })
      .finally(() => setLoading(false))
  }, [token])

  return (
    <div className="container xpay-fade-in">
      <TradingViewMarketOverview />
      <div className="card xpay-card shadow-sm mb-3">
        <div className="card-body">
          <div className="d-flex justify-content-between align-items-start">
            <div>
              <div className="text-muted small">Wallet</div>
              <div className="h2 mb-0">{loading || !balance ? '—' : `$${(balance.usdCents / 100).toFixed(2)}`}</div>
              <div className="text-muted small">USD balance</div>
            </div>
            <span className={`badge ${kycStatus === 'APPROVED' ? 'bg-success' : 'bg-secondary'}`}>
              {kycStatus ?? 'KYC'}
            </span>
          </div>

          <div className="row g-2 mt-3">
            <div className="col-6">
              <div className="card xpay-card">
                <div className="card-body py-2">
                  <div className="text-muted small">NGN</div>
                  <div className="fw-bold">{loading || !balance ? '—' : `₦${(balance.ngnKobo / 100).toFixed(2)}`}</div>
                </div>
              </div>
            </div>
            <div className="col-6">
              <div className="card xpay-card">
                <div className="card-body py-2">
                  <div className="text-muted small">USDT</div>
                  <div className="fw-bold">{loading || !balance ? '—' : (balance.usdtCents / 100).toFixed(2)}</div>
                </div>
              </div>
            </div>
            <div className="col-6">
              <div className="card xpay-card">
                <div className="card-body py-2">
                  <div className="text-muted small">BTC</div>
                  <div className="fw-bold">{loading || !balance ? '—' : (balance.btcSats / 100000000).toFixed(8)}</div>
                </div>
              </div>
            </div>
            <div className="col-6">
              <div className="card xpay-card">
                <div className="card-body py-2">
                  <div className="text-muted small">ETH</div>
                  <div className="fw-bold">{loading || !balance ? '—' : (formatEth(balance.ethWei) ?? '—')}</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="row g-2 mb-3">
        <ActionCard to="/buy" label="Buy" subtitle="Crypto onramp" variant="buy" icon={<IconBuy />} />
        <ActionCard to="/sell" label="Sell" subtitle="Offramp to USD" variant="sell" icon={<IconSell />} />
        <ActionCard to="/convert" label="Convert" subtitle="USD ↔ NGN ↔ Crypto" variant="convert" icon={<IconConvert />} />
        <ActionCard to="/cards" label="Gift Cards" subtitle="Buy / sell cards" variant="cards" icon={<IconCards />} />
        <ActionCard to="/bills" label="Pay Bills" subtitle="US billers" variant="bills" icon={<IconBills />} />
        <ActionCard to="/deposit" label="Deposit" subtitle="Add funds" variant="deposit" icon={<IconDeposit />} />
      </div>

      {error ? <div className="alert alert-danger py-2">{error}</div> : null}

      <div className="card xpay-card shadow-sm">
        <div className="card-body">
          <div className="fw-bold mb-2">Status</div>
          <div className="text-muted small">Check Activity for your latest transactions.</div>
        </div>
      </div>
    </div>
  )
}
