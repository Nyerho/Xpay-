import { useEffect, useMemo, useRef } from 'react'

const symbols: Record<string, string> = {
  BTC: 'BINANCE:BTCUSDT',
  ETH: 'BINANCE:ETHUSDT',
  USDT: 'BINANCE:USDTUSD',
}

export function TradingViewAdvancedChart(props: { asset: 'BTC' | 'ETH' | 'USDT' }) {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const symbol = symbols[props.asset] ?? 'BINANCE:BTCUSDT'

  const config = useMemo(
    () => ({
      autosize: true,
      symbol,
      interval: '60',
      timezone: 'Etc/UTC',
      theme: 'dark',
      style: '1',
      locale: 'en',
      backgroundColor: 'rgba(15, 13, 20, 0.92)',
      gridColor: 'rgba(255, 255, 255, 0.06)',
      hide_top_toolbar: false,
      hide_legend: false,
      allow_symbol_change: false,
      save_image: false,
      support_host: 'https://www.tradingview.com',
    }),
    [symbol],
  )

  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    el.innerHTML = ''
    const script = document.createElement('script')
    script.src = 'https://s3.tradingview.com/external-embedding/embed-widget-advanced-chart.js'
    script.async = true
    script.type = 'text/javascript'
    script.innerHTML = JSON.stringify(config)
    el.appendChild(script)
  }, [config])

  return (
    <div className="card xpay-card shadow-sm mb-3">
      <div className="card-body">
        <div className="d-flex align-items-center justify-content-between mb-2">
          <div className="fw-semibold">Chart</div>
          <div className="text-muted small">{props.asset}</div>
        </div>
        <div style={{ height: 380 }}>
          <div ref={containerRef} style={{ width: '100%', height: '100%' }} />
        </div>
      </div>
    </div>
  )
}

