import { useEffect, useMemo, useState } from 'react'
import { apiFetch } from '../api'
import { useAuth } from '../auth/useAuth'

type Row = {
  id: string
  type: string
  status: string
  asset: string | null
  amountUsdCents: number | null
  displayAmount?: string | null
  createdAt: string
}

type TxDetail = Row & {
  amountAssetMinor: number | null
  metadataJson: string
  externalRef: string | null
  updatedAt: string
}

function formatWhen(iso: string) {
  const d = new Date(iso)
  return d.toLocaleString()
}

function safeJsonParse(s: string): Record<string, unknown> {
  try {
    const v: unknown = JSON.parse(s || '{}')
    if (v && typeof v === 'object' && !Array.isArray(v)) return v as Record<string, unknown>
    return {}
  } catch {
    return {}
  }
}

function formatUsd(cents: number | null) {
  if (cents === null) return ''
  return `$${(cents / 100).toFixed(2)}`
}

function getString(v: Record<string, unknown>, key: string) {
  const s = v[key]
  return typeof s === 'string' ? s : null
}

function getNumber(v: Record<string, unknown>, key: string) {
  const n = v[key]
  return typeof n === 'number' ? n : null
}

export function ActivityPage() {
  const { token } = useAuth()
  const [rows, setRows] = useState<Row[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [detail, setDetail] = useState<TxDetail | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)

  useEffect(() => {
    if (!token) return
    setLoading(true)
    setError(null)
    apiFetch<Row[]>('/api/consumer/transactions', { token })
      .then(setRows)
      .catch((e: unknown) => {
        const msg = e && typeof e === 'object' && 'error' in e ? String((e as { error: string }).error) : 'load_failed'
        setError(msg)
      })
      .finally(() => setLoading(false))
  }, [token])

  useEffect(() => {
    if (!token || !selectedId) return
    setDetailLoading(true)
    setDetail(null)
    apiFetch<TxDetail>(`/api/consumer/transactions/${selectedId}`, { token })
      .then(setDetail)
      .catch((e: unknown) => {
        const msg = e && typeof e === 'object' && 'error' in e ? String((e as { error: string }).error) : 'load_failed'
        setError(msg)
      })
      .finally(() => setDetailLoading(false))
  }, [selectedId, token])

  const receipt = useMemo(() => {
    if (!detail) return null
    const meta = safeJsonParse(detail.metadataJson)
    return {
      meta,
      title:
        detail.type === 'CRYPTO_BUY'
          ? `Buy ${detail.asset ?? ''}`.trim()
          : detail.type === 'CRYPTO_SELL'
            ? `Sell ${detail.asset ?? ''}`.trim()
            : detail.type === 'CONVERT'
              ? `Convert ${detail.asset ?? ''}`.trim()
              : detail.type,
      usdAmount: formatUsd(detail.amountUsdCents),
      ngnAmount: detail.displayAmount ?? null,
    }
  }, [detail])

  return (
    <div className="container xpay-fade-in">
      <div className="h4 mb-3">Activity</div>

      {error ? <div className="alert alert-danger py-2">{error}</div> : null}

      {selectedId ? (
        <div className="card xpay-card shadow-sm mb-3">
          <div className="card-body">
            <div className="d-flex align-items-center justify-content-between">
              <div className="fw-bold">Receipt</div>
              <button className="btn btn-sm btn-outline-light" type="button" onClick={() => setSelectedId(null)}>
                Close
              </button>
            </div>

            {detailLoading ? <div className="text-muted small mt-2">Loading…</div> : null}

            {receipt && detail ? (
              <div className="mt-3">
                <div className="fw-semibold">{receipt.title}</div>
                <div className="text-muted small">{formatWhen(detail.createdAt)}</div>

                <div className="row g-2 mt-2">
                  <div className="col-12 col-md-6">
                    <div className="text-muted small">Status</div>
                    <div>
                      <span
                        className={`badge ${
                          detail.status === 'COMPLETE'
                            ? 'bg-success'
                            : detail.status === 'PENDING'
                              ? 'bg-secondary'
                              : detail.status === 'FAILED'
                                ? 'bg-danger'
                                : 'bg-warning text-dark'
                        }`}
                      >
                        {detail.status}
                      </span>
                    </div>
                  </div>
                  <div className="col-12 col-md-6">
                    <div className="text-muted small">Amount</div>
                    <div className="fw-semibold">{receipt.usdAmount || receipt.ngnAmount || '—'}</div>
                  </div>
                </div>

                {detail.type === 'CRYPTO_BUY' || detail.type === 'CRYPTO_SELL' ? (
                  <div className="mt-3">
                    <div className="text-muted small">Asset</div>
                    <div className="fw-semibold">
                      {getString(receipt.meta, 'assetAmount') ? `${getString(receipt.meta, 'assetAmount')} ${detail.asset ?? ''}` : detail.asset ?? ''}
                    </div>
                    <div className="text-muted small mt-2">Price</div>
                    <div className="fw-semibold">
                      {getNumber(receipt.meta, 'priceUsdCents') === null ? '—' : `$${((getNumber(receipt.meta, 'priceUsdCents') ?? 0) / 100).toFixed(2)}`}
                    </div>
                  </div>
                ) : null}

                {detail.type === 'CONVERT' ? (
                  <div className="mt-3">
                    <div className="row g-2">
                      <div className="col-12 col-md-6">
                        <div className="text-muted small">From</div>
                        <div className="fw-semibold">
                          {getString(receipt.meta, 'fromAmount') && getString(receipt.meta, 'from')
                            ? `${getString(receipt.meta, 'fromAmount')} ${getString(receipt.meta, 'from')}`
                            : '—'}
                        </div>
                      </div>
                      <div className="col-12 col-md-6">
                        <div className="text-muted small">To</div>
                        <div className="fw-semibold">
                          {getString(receipt.meta, 'toAmount') && getString(receipt.meta, 'to')
                            ? `${getString(receipt.meta, 'toAmount')} ${getString(receipt.meta, 'to')}`
                            : '—'}
                        </div>
                      </div>
                    </div>
                  </div>
                ) : null}

                <div className="mt-3">
                  <div className="text-muted small">Transaction ID</div>
                  <div className="d-flex gap-2 align-items-center">
                    <div className="font-monospace small">{detail.id}</div>
                    <button
                      className="btn btn-sm btn-outline-light"
                      type="button"
                      onClick={() => {
                        void navigator.clipboard.writeText(detail.id)
                      }}
                    >
                      Copy
                    </button>
                  </div>
                </div>
              </div>
            ) : null}
          </div>
        </div>
      ) : null}

      <div className="card xpay-card shadow-sm">
        <div className="list-group list-group-flush">
          {loading ? <div className="list-group-item text-muted">Loading…</div> : null}
          {!loading && rows.length === 0 ? <div className="list-group-item text-muted">No activity yet</div> : null}
          {rows.map((r) => (
            <button
              key={r.id}
              type="button"
              className="list-group-item list-group-item-action d-flex justify-content-between align-items-center"
              onClick={() => setSelectedId(r.id)}
            >
              <div>
                <div className="fw-semibold">
                  {r.type === 'CRYPTO_BUY'
                    ? `Buy ${r.asset ?? ''}`.trim()
                    : r.type === 'CRYPTO_SELL'
                      ? `Sell ${r.asset ?? ''}`.trim()
                      : r.type === 'CONVERT'
                        ? `Convert ${r.asset ?? ''}`.trim()
                        : r.type}
                </div>
                <div className="text-muted small">
                  {r.asset ? `${r.asset} • ` : ''}
                  {formatWhen(r.createdAt)}
                </div>
              </div>
              <div className="text-end">
                <div className="fw-bold">
                  {r.amountUsdCents === null
                    ? r.displayAmount ?? ''
                    : r.type === 'CRYPTO_BUY'
                      ? `-${formatUsd(r.amountUsdCents)}`
                      : formatUsd(r.amountUsdCents)}
                </div>
                <span
                  className={`badge ${
                    r.status === 'COMPLETE'
                      ? 'bg-success'
                      : r.status === 'PENDING'
                        ? 'bg-secondary'
                        : r.status === 'FAILED'
                          ? 'bg-danger'
                          : 'bg-warning text-dark'
                  }`}
                >
                  {r.status}
                </span>
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
