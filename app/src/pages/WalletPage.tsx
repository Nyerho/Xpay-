export function WalletPage() {
  const assets = [
    { symbol: 'USD', name: 'USD Balance', amount: '1,248.20', sub: 'Spendable' },
    { symbol: 'USDT', name: 'USDT (TRC20)', amount: '250.00', sub: '$250.00' },
    { symbol: 'BTC', name: 'Bitcoin', amount: '0.0100', sub: '$582.00' },
    { symbol: 'ETH', name: 'Ethereum', amount: '0.2000', sub: '$640.00' },
  ]

  return (
    <div className="container">
      <div className="h4 mb-3">Wallet</div>
      <div className="card shadow-sm">
        <div className="list-group list-group-flush">
          {assets.map((a) => (
            <div key={a.symbol} className="list-group-item d-flex justify-content-between align-items-center">
              <div>
                <div className="fw-semibold">{a.name}</div>
                <div className="text-muted small">{a.sub}</div>
              </div>
              <div className="text-end">
                <div className="fw-bold">{a.amount}</div>
                <div className="text-muted small">{a.symbol}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
      <div className="row g-2 mt-3">
        <div className="col-6">
          <button className="btn btn-outline-primary w-100">Receive (Preview)</button>
        </div>
        <div className="col-6">
          <button className="btn btn-primary w-100">Send (Preview)</button>
        </div>
      </div>
    </div>
  )
}

