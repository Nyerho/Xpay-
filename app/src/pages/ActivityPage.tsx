export function ActivityPage() {
  const rows = [
    { type: 'Crypto', title: 'Sell BTC', status: 'Complete', detail: '$582.00', when: '2 mins ago' },
    { type: 'Bills', title: 'Pay FPL', status: 'Pending', detail: '122.40 USDT', when: '10 mins ago' },
    { type: 'Cards', title: 'Sell Amazon', status: 'Reviewing', detail: '75.00 USDT', when: '1 hour ago' },
  ]

  return (
    <div className="container">
      <div className="h4 mb-3">Activity</div>

      <div className="d-flex gap-2 mb-3">
        <button className="btn btn-sm btn-outline-secondary">All</button>
        <button className="btn btn-sm btn-outline-secondary">Crypto</button>
        <button className="btn btn-sm btn-outline-secondary">Cards</button>
        <button className="btn btn-sm btn-outline-secondary">Bills</button>
      </div>

      <div className="card shadow-sm">
        <div className="list-group list-group-flush">
          {rows.map((r, idx) => (
            <div key={idx} className="list-group-item d-flex justify-content-between align-items-center">
              <div>
                <div className="fw-semibold">{r.title}</div>
                <div className="text-muted small">
                  {r.type} • {r.when}
                </div>
              </div>
              <div className="text-end">
                <div className="fw-bold">{r.detail}</div>
                <span
                  className={`badge ${
                    r.status === 'Complete'
                      ? 'bg-success'
                      : r.status === 'Pending'
                        ? 'bg-secondary'
                        : 'bg-warning text-dark'
                  }`}
                >
                  {r.status}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

