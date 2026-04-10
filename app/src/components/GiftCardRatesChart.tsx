import { useEffect, useMemo, useState } from 'react'

type Rate = { buyPct: number; sellPct: number }

function brandLabel(key: string) {
  return key.replaceAll('_', ' ').toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase())
}

export function GiftCardRatesChart(props: { rates: Record<string, Rate> | null; loading?: boolean }) {
  const [ready, setReady] = useState(false)

  useEffect(() => {
    if (!props.rates) return
    const id = window.setTimeout(() => setReady(true), 50)
    return () => window.clearTimeout(id)
  }, [props.rates])

  const rows = useMemo(() => {
    const r = props.rates
    if (!r) return []
    return Object.entries(r)
      .map(([brand, rate]) => ({
        brand,
        label: brandLabel(brand),
        buyPct: Math.max(0, Math.min(1, Number(rate.buyPct) || 0)),
        sellPct: Math.max(0, Math.min(1, Number(rate.sellPct) || 0)),
      }))
      .sort((a, b) => b.buyPct - a.buyPct)
      .slice(0, 8)
  }, [props.rates])

  return (
    <div className="card xpay-card shadow-sm mb-3 xpay-fade-in">
      <div className="card-body">
        <div className="d-flex align-items-center justify-content-between mb-2">
          <div className="fw-semibold">Gift card rates</div>
          <div className="text-muted small">Buy / Sell</div>
        </div>

        {props.loading ? <div className="text-muted small">Loading…</div> : null}
        {!props.loading && rows.length === 0 ? <div className="text-muted small">Rates unavailable</div> : null}

        <div className="xpay-rates-grid mt-2">
          {rows.map((r) => (
            <div key={r.brand} className="xpay-rates-row">
              <div className="xpay-rates-brand">{r.label}</div>
              <div className="xpay-rates-bars">
                <div className="xpay-rates-bar-wrap">
                  <div className={`xpay-rates-bar xpay-rates-bar-buy ${ready ? 'is-ready' : ''}`} style={{ width: `${r.buyPct * 100}%` }} />
                </div>
                <div className="xpay-rates-bar-wrap">
                  <div className={`xpay-rates-bar xpay-rates-bar-sell ${ready ? 'is-ready' : ''}`} style={{ width: `${r.sellPct * 100}%` }} />
                </div>
              </div>
              <div className="xpay-rates-values">
                <div className="xpay-rates-v">{(r.buyPct * 100).toFixed(0)}%</div>
                <div className="xpay-rates-v">{(r.sellPct * 100).toFixed(0)}%</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

