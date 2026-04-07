import { useEffect, useMemo, useState } from 'react'
import { apiFetch } from '../api'
import { useAuth } from '../auth/useAuth'
import type { StaffRole } from '../auth/types'
import { formatDate } from '../utils'

type UserRow = {
  id: string
  email: string
  phone: string | null
  role: 'CONSUMER' | StaffRole
  isFrozen: boolean
  mfaEnabled: boolean
  createdAt: string
  lastLoginAt: string | null
}

const roles: Array<UserRow['role']> = ['CONSUMER', 'SUPPORT', 'FINANCE', 'ADMIN', 'SUPERADMIN']

export function UsersPage() {
  const { token, me } = useAuth()
  const [q, setQ] = useState('')
  const [rows, setRows] = useState<UserRow[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [createEmail, setCreateEmail] = useState('')
  const [createPhone, setCreatePhone] = useState('')
  const [createPassword, setCreatePassword] = useState('')
  const [createRole, setCreateRole] = useState<UserRow['role']>('SUPPORT')
  const [createBusy, setCreateBusy] = useState(false)

  const canManageUsers = useMemo(() => {
    return me?.role === 'ADMIN' || me?.role === 'SUPERADMIN'
  }, [me?.role])

  function load() {
    if (!token) return
    setLoading(true)
    setError(null)
    apiFetch<UserRow[]>('/api/admin/users' + (q.trim() ? `?q=${encodeURIComponent(q.trim())}` : ''), {
      token,
    })
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

  async function patchUser(id: string, body: Record<string, unknown>) {
    if (!token) return
    await apiFetch<{ ok: true }>(`/api/admin/users/${id}`, { method: 'PATCH', token, body })
    load()
  }

  async function deleteUser(id: string) {
    if (!token) return
    await apiFetch<{ ok: true }>(`/api/admin/users/${id}`, { method: 'DELETE', token })
    load()
  }

  return (
    <div className="container-fluid">
      <div className="d-flex flex-wrap gap-2 align-items-center justify-content-between mb-3">
        <div className="h4 mb-0">Users</div>
        <div className="d-flex gap-2">
          <input
            className="form-control"
            style={{ width: 280 }}
            placeholder="Search by email…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
          <button className="btn btn-outline-primary" onClick={() => load()} disabled={loading}>
            Search
          </button>
        </div>
      </div>

      {error ? <div className="alert alert-danger py-2">{error}</div> : null}

      {canManageUsers ? (
        <div className="card shadow-sm mb-3">
          <div className="card-body">
            <div className="fw-bold mb-2">Create user</div>
            <form
              className="row g-2"
              onSubmit={(e) => {
                e.preventDefault()
                if (!token) return
                setCreateBusy(true)
                apiFetch<{ id: string }>('/api/admin/users', {
                  method: 'POST',
                  token,
                  body: {
                    email: createEmail.trim(),
                    phone: createPhone.trim() ? createPhone.trim() : undefined,
                    password: createPassword,
                    role: createRole,
                  },
                })
                  .then(() => {
                    setCreateEmail('')
                    setCreatePhone('')
                    setCreatePassword('')
                    setCreateRole('SUPPORT')
                    load()
                  })
                  .catch((e: unknown) => {
                    const msg =
                      e && typeof e === 'object' && 'error' in e ? String((e as { error: string }).error) : 'create_failed'
                    setError(msg)
                  })
                  .finally(() => setCreateBusy(false))
              }}
            >
              <div className="col-12 col-md-4">
                <input
                  className="form-control"
                  type="email"
                  placeholder="email"
                  value={createEmail}
                  onChange={(e) => setCreateEmail(e.target.value)}
                  required
                />
              </div>
              <div className="col-12 col-md-3">
                <input
                  className="form-control"
                  placeholder="phone (optional)"
                  value={createPhone}
                  onChange={(e) => setCreatePhone(e.target.value)}
                />
              </div>
              <div className="col-12 col-md-3">
                <input
                  className="form-control"
                  type="password"
                  placeholder="password"
                  value={createPassword}
                  onChange={(e) => setCreatePassword(e.target.value)}
                  minLength={8}
                  required
                />
              </div>
              <div className="col-8 col-md-1">
                <select className="form-select" value={createRole} onChange={(e) => setCreateRole(e.target.value as UserRow['role'])}>
                  {roles.map((r) => (
                    <option key={r} value={r}>
                      {r}
                    </option>
                  ))}
                </select>
              </div>
              <div className="col-4 col-md-1 d-grid">
                <button className="btn btn-primary" disabled={createBusy}>
                  Create
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : (
        <div className="alert alert-warning py-2">Only ADMIN/SUPERADMIN can create/update/delete users.</div>
      )}

      <div className="card shadow-sm">
        <div className="table-responsive">
          <table className="table table-sm table-striped mb-0 align-middle">
            <thead className="table-light">
              <tr>
                <th>Email</th>
                <th>Role</th>
                <th>Status</th>
                <th>2FA</th>
                <th>Created</th>
                <th>Last login</th>
                <th style={{ width: 320 }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((u) => (
                <tr key={u.id}>
                  <td>
                    <div className="fw-semibold">{u.email}</div>
                    <div className="text-muted small">{u.id}</div>
                  </td>
                  <td>
                    <span className={`badge ${u.role === 'SUPERADMIN' ? 'bg-danger' : u.role === 'ADMIN' ? 'bg-primary' : 'bg-secondary'}`}>
                      {u.role}
                    </span>
                  </td>
                  <td>{u.isFrozen ? <span className="badge bg-danger">Frozen</span> : <span className="badge bg-success">Active</span>}</td>
                  <td>{u.mfaEnabled ? <span className="badge bg-success">On</span> : <span className="badge bg-secondary">Off</span>}</td>
                  <td className="text-muted small">{formatDate(u.createdAt)}</td>
                  <td className="text-muted small">{formatDate(u.lastLoginAt)}</td>
                  <td>
                    <div className="d-flex flex-wrap gap-2">
                      <button
                        className="btn btn-outline-secondary btn-sm"
                        disabled={!canManageUsers || (u.role === 'SUPERADMIN' && me?.role !== 'SUPERADMIN')}
                        onClick={() => patchUser(u.id, { isFrozen: !u.isFrozen })}
                      >
                        {u.isFrozen ? 'Unfreeze' : 'Freeze'}
                      </button>
                      <select
                        className="form-select form-select-sm"
                        style={{ width: 150 }}
                        disabled={!canManageUsers || (u.role === 'SUPERADMIN' && me?.role !== 'SUPERADMIN')}
                        value={u.role}
                        onChange={(e) => patchUser(u.id, { role: e.target.value })}
                      >
                        {roles.map((r) => (
                          <option key={r} value={r}>
                            {r}
                          </option>
                        ))}
                      </select>
                      <button
                        className="btn btn-outline-danger btn-sm"
                        disabled={!canManageUsers || (u.role === 'SUPERADMIN' && me?.role !== 'SUPERADMIN')}
                        onClick={() => {
                          if (!confirm(`Delete ${u.email}?`)) return
                          deleteUser(u.id).catch(() => {})
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
                  <td colSpan={7} className="text-center text-muted py-4">
                    No users
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
