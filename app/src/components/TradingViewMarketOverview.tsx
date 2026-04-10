import { useEffect, useMemo, useRef } from 'react'

export function TradingViewMarketOverview() {
  const containerRef = useRef<HTMLDivElement | null>(null)

  const config = useMemo(
    () => ({
      colorTheme: 'dark',
      dateRange: '12M',
      showChart: true,
      locale: 'en',
      width: '100%',
      height: 340,
      largeChartUrl: '',
      isTransparent: true,
      showSymbolLogo: true,
      showFloatingTooltip: true,
      plotLineColorGrowing: 'rgba(34, 197, 94, 0.85)',
      plotLineColorFalling: 'rgba(244, 63, 94, 0.85)',
      gridLineColor: 'rgba(255, 255, 255, 0.06)',
      scaleFontColor: 'rgba(255, 255, 255, 0.72)',
      belowLineFillColorGrowing: 'rgba(34, 197, 94, 0.12)',
      belowLineFillColorFalling: 'rgba(244, 63, 94, 0.12)',
      belowLineFillColorGrowingBottom: 'rgba(34, 197, 94, 0.02)',
      belowLineFillColorFallingBottom: 'rgba(244, 63, 94, 0.02)',
      symbolActiveColor: 'rgba(168, 85, 247, 0.22)',
      tabs: [
        {
          title: 'Crypto',
          symbols: [
            { s: 'BINANCE:BTCUSDT', d: 'Bitcoin' },
            { s: 'BINANCE:ETHUSDT', d: 'Ethereum' },
            { s: 'BINANCE:BNBUSDT', d: 'BNB' },
            { s: 'BINANCE:SOLUSDT', d: 'Solana' },
          ],
          originalTitle: 'Crypto',
        },
      ],
    }),
    [],
  )

  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    el.innerHTML = ''
    const script = document.createElement('script')
    script.src = 'https://s3.tradingview.com/external-embedding/embed-widget-market-overview.js'
    script.async = true
    script.type = 'text/javascript'
    script.innerHTML = JSON.stringify(config)
    el.appendChild(script)
  }, [config])

  return (
    <div className="card xpay-card shadow-sm mb-3">
      <div className="card-body">
        <div className="fw-semibold mb-2">Market overview</div>
        <div style={{ height: 340 }}>
          <div ref={containerRef} style={{ width: '100%', height: '100%' }} />
        </div>
      </div>
    </div>
  )
}

