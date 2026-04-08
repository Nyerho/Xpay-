import { useEffect, useMemo, useState } from 'react'
import { apiDownload, apiFetch } from '../api'
import { useAuth } from '../auth/useAuth'
import { formatDate } from '../utils'

type Setting = {
  key: string
  valueJson: string
  updatedAt: string
  updatedById: string | null
}

const keys = ['spreads', 'giftCardRates', 'depositInstructions'] as const
type Key = (typeof keys)[number]

export function SettingsPage() {
  const { token, me } = useAuth()
  const [key, setKey] = useState<Key>('spreads')
  const [setting, setSetting] = useState<Setting | null>(null)
  const [value, setValue] = useState('')
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [ok, setOk] = useState<string | null>(null)

  const canFinance = useMemo(() => {
    return me?.role === 'FINANCE' || me?.role === 'ADMIN' || me?.role === 'SUPERADMIN'
  }, [me?.role])

  function load(k: Key) {
    if (!token) return
    setLoading(true)
    setError(null)
    setOk(null)
    apiFetch<Setting>(`/api/admin/settings/${k}`, { token })
      .then((s) => {
        setSetting(s)
        setValue(s.valueJson)
      })
      .catch((e: unknown) => {
        const msg = e && typeof e === 'object' && 'error' in e ? String((e as { error: string }).error) : 'load_failed'
        setError(msg)
      })
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    load(key)
  }, [key])

  function validateJson(v: string) {
    JSON.parse(v)
  }

  return (
    <div className="container-fluid">
      <div className="d-flex flex-wrap gap-2 align-items-center justify-content-between mb-3">
        <div className="h4 mb-0">Settings</div>
        <div className="d-flex flex-wrap gap-2">
          <button
            className="btn btn-outline-secondary btn-sm"
            disabled={!token}
            onClick={() => {
              if (!token) return
              apiDownload('/api/admin/export/users.csv', 'users.csv', token).catch(() => {})
            }}
          >
            Export users.csv
          </button>
          <button
            className="btn btn-outline-secondary btn-sm"
            disabled={!token}
            onClick={() => {
              if (!token) return
              apiDownload('/api/admin/export/transactions.csv', 'transactions.csv', token).catch(() => {})
            }}
          >
            Export transactions.csv
          </button>
        </div>
      </div>

      {!canFinance ? <div className="alert alert-warning py-2">FINANCE/ADMIN/SUPERADMIN only.</div> : null}
      {error ? <div className="alert alert-danger py-2">{error}</div> : null}
      {ok ? <div className="alert alert-success py-2">{ok}</div> : null}

      <div className="card shadow-sm">
        <div className="card-body">
          <div className="row g-3">
            <div className="col-12 col-lg-3">
              <label className="form-label">Key</label>
              <select className="form-select" value={key} onChange={(e) => setKey(e.target.value as Key)}>
                {keys.map((k) => (
                  <option key={k} value={k}>
                    {k}
                  </option>
                ))}
              </select>
              <div className="text-muted small mt-2">Updated: {setting ? formatDate(setting.updatedAt) : ''}</div>
            </div>
            <div className="col-12 col-lg-9">
              <label className="form-label">valueJson</label>
              <textarea
                className="form-control font-monospace"
                rows={10}
                value={value}
                onChange={(e) => setValue(e.target.value)}
                disabled={!canFinance || loading}
              />
              <div className="d-flex flex-wrap gap-2 mt-2">
                <button
                  className="btn btn-primary"
                  disabled={!canFinance || !token || saving}
                  onClick={() => {
                    if (!token) return
                    setSaving(true)
                    setError(null)
                    setOk(null)
                    try {
                      validateJson(value)
                    } catch {
                      setSaving(false)
                      setError('invalid_json')
                      return
                    }
                    apiFetch<{ ok: true }>(`/api/admin/settings/${key}`, {
                      method: 'PUT',
                      token,
                      body: { valueJson: value },
                    })
                      .then(() => {
                        setOk('saved')
                        load(key)
                      })
                      .catch((e: unknown) => {
                        const msg =
                          e && typeof e === 'object' && 'error' in e ? String((e as { error: string }).error) : 'save_failed'
                        setError(msg)
                      })
                      .finally(() => setSaving(false))
                  }}
                >
                  Save
                </button>
                <button className="btn btn-outline-primary" onClick={() => load(key)} disabled={loading}>
                  Reload
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
