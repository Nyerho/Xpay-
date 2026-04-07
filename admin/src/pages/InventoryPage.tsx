import { useEffect, useMemo, useState } from 'react'
import { apiFetch } from '../api'
import { useAuth } from '../auth/useAuth'
import { formatCents, formatDate } from '../utils'

type Item = {
  id: string
  brand: string
  valueUsdCents: number
  code: string
  status: 'AVAILABLE' | 'SOLD' | 'VOID'
  purchasedById: string | null
  purchasedAt: string | null
  createdAt: string
  updatedAt: string
}

const statuses: Item['status'][] = ['AVAILABLE', 'SOLD', 'VOID']

export function InventoryPage() {
  const { token, me } = useAuth()
  const [rows, setRows] = useState<Item[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const canManage = useMemo(() => me?.role === 'ADMIN' || me?.role === 'SUPERADMIN', [me?.role])

  const [brand, setBrand] = useState('AMAZON')
  const [valueUsd, setValueUsd] = useState('50')
  const [code, setCode] = useState('')
  const [creating, setCreating] = useState(false)

  function load() {
    if (!token) return
    setLoading(true)
    setError(null)
    apiFetch<Item[]>('/api/admin/inventory', { token })
      .then(setRows)
      .catch((e: unknown) => {
        const msg = e && typeof e === 'object' && 'error' in e ? String((e as { error: string }).error) : 'load_failed'
        setError(msg)
      })
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    load()
  }, [])

  async function update(id: string, body: Partial<Pick<Item, 'status'>>) {
    if (!token) return
    await apiFetch<{ ok: true }>(`/api/admin/inventory/${id}`, { method: 'PATCH', token, body })
    load()
  }

  async function remove(id: string) {
    if (!token) return
    await apiFetch<{ ok: true }>(`/api/admin/inventory/${id}`, { method: 'DELETE', token })
    load()
  }

  return (
    <div className="container-fluid">
      <div className="d-flex align-items-center justify-content-between mb-3">
        <div className="h4 mb-0">Inventory</div>
        <button className="btn btn-outline-primary btn-sm" onClick={() => load()} disabled={loading}>
          Refresh
        </button>
      </div>

      {error ? <div className="alert alert-danger py-2">{error}</div> : null}
      {!canManage ? <div className="alert alert-warning py-2">Only ADMIN/SUPERADMIN can manage inventory.</div> : null}

      {canManage ? (
        <div className="card shadow-sm mb-3">
          <div className="card-body">
            <div className="fw-bold mb-2">Add inventory item</div>
            <form
              className="row g-2"
              onSubmit={(e) => {
                e.preventDefault()
                if (!token) return
                setCreating(true)
                const cents = Math.round(Number(valueUsd) * 100)
                apiFetch<{ id: string }>('/api/admin/inventory', {
                  method: 'POST',
                  token,
                  body: { brand: brand.trim(), valueUsdCents: cents, code: code.trim() },
                })
                  .then(() => {
                    setCode('')
                    load()
                  })
                  .catch((e: unknown) => {
                    const msg =
                      e && typeof e === 'object' && 'error' in e ? String((e as { error: string }).error) : 'create_failed'
                    setError(msg)
                  })
                  .finally(() => setCreating(false))
              }}
            >
              <div className="col-12 col-md-3">
                <input className="form-control" value={brand} onChange={(e) => setBrand(e.target.value)} placeholder="brand" required />
              </div>
              <div className="col-12 col-md-2">
                <input
                  className="form-control"
                  value={valueUsd}
                  onChange={(e) => setValueUsd(e.target.value)}
                  placeholder="value USD"
                  inputMode="decimal"
                  required
                />
              </div>
              <div className="col-12 col-md-5">
                <input className="form-control" value={code} onChange={(e) => setCode(e.target.value)} placeholder="code" required />
              </div>
              <div className="col-12 col-md-2 d-grid">
                <button className="btn btn-primary" disabled={creating}>
                  Add
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}

      <div className="card shadow-sm">
        <div className="table-responsive">
          <table className="table table-sm table-striped mb-0 align-middle">
            <thead className="table-light">
              <tr>
                <th>Brand</th>
                <th>Value</th>
                <th>Status</th>
                <th>Code</th>
                <th>Created</th>
                <th style={{ width: 250 }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id}>
                  <td className="fw-semibold">{r.brand}</td>
                  <td className="text-muted">{formatCents(r.valueUsdCents)}</td>
                  <td>
                    <span className={`badge ${r.status === 'AVAILABLE' ? 'bg-success' : r.status === 'SOLD' ? 'bg-secondary' : 'bg-danger'}`}>
                      {r.status}
                    </span>
                  </td>
                  <td className="font-monospace small">{r.code}</td>
                  <td className="text-muted small">{formatDate(r.createdAt)}</td>
                  <td>
                    <div className="d-flex flex-wrap gap-2">
                      <select
                        className="form-select form-select-sm"
                        style={{ width: 140 }}
                        value={r.status}
                        disabled={!canManage}
                        onChange={(e) => update(r.id, { status: e.target.value as Item['status'] })}
                      >
                        {statuses.map((s) => (
                          <option key={s} value={s}>
                            {s}
                          </option>
                        ))}
                      </select>
                      <button
                        className="btn btn-outline-danger btn-sm"
                        disabled={!canManage}
                        onClick={() => {
                          if (!confirm(`Delete inventory item ${r.id}?`)) return
                          remove(r.id).catch(() => {})
                        }}
                      >
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {rows.length === 0 && !loading ? (
                <tr>
                  <td colSpan={6} className="text-center text-muted py-4">
                    No inventory
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
