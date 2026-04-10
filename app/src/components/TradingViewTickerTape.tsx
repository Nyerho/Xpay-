import { useEffect, useMemo, useRef } from 'react'

export function TradingViewTickerTape() {
  const containerRef = useRef<HTMLDivElement | null>(null)

  const config = useMemo(
    () => ({
      symbols: [
        { proName: 'BINANCE:BTCUSDT', title: 'BTC' },
        { proName: 'BINANCE:ETHUSDT', title: 'ETH' },
        { proName: 'BINANCE:BNBUSDT', title: 'BNB' },
        { proName: 'BINANCE:SOLUSDT', title: 'SOL' },
        { proName: 'BINANCE:XRPUSDT', title: 'XRP' },
      ],
      showSymbolLogo: true,
      colorTheme: 'dark',
      isTransparent: false,
      displayMode: 'adaptive',
      locale: 'en',
    }),
    [],
  )

  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    el.innerHTML = ''
    const script = document.createElement('script')
    script.src = 'https://s3.tradingview.com/external-embedding/embed-widget-ticker-tape.js'
    script.async = true
    script.type = 'text/javascript'
    script.innerHTML = JSON.stringify(config)
    el.appendChild(script)
  }, [config])

  return (
    <div className="card xpay-card shadow-sm mb-3 xpay-fade-in">
      <div className="card-body">
        <div className="fw-semibold mb-2">Crypto watch</div>
        <div style={{ height: 68 }}>
          <div ref={containerRef} style={{ width: '100%', height: '100%', background: '#07060a' }} />
        </div>
      </div>
    </div>
  )
}

