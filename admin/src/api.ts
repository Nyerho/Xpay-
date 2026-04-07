export type ApiError = {
  error: string
  message?: string
}

function withBaseUrl(path: string) {
  const base = (import.meta.env.VITE_API_BASE_URL as string | undefined) ?? ''
  if (!base) return path
  if (path.startsWith('http://') || path.startsWith('https://')) return path
  const normalizedBase = base.endsWith('/') ? base.slice(0, -1) : base
  const normalizedPath = path.startsWith('/') ? path : `/${path}`
  return normalizedBase + normalizedPath
}

export async function apiFetch<T>(
  path: string,
  opts: {
    method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'
    token?: string | null
    body?: unknown
    signal?: AbortSignal
  } = {},
): Promise<T> {
  const res = await fetch(withBaseUrl(path), {
    method: opts.method ?? (opts.body ? 'POST' : 'GET'),
    headers: {
      'content-type': 'application/json',
      ...(opts.token ? { authorization: `Bearer ${opts.token}` } : {}),
    },
    body: opts.body === undefined ? undefined : JSON.stringify(opts.body),
    signal: opts.signal,
  })

  const text = await res.text()
  const json = text ? (JSON.parse(text) as unknown) : null

  if (!res.ok) {
    const err = (json && typeof json === 'object' ? (json as ApiError) : null) ?? {
      error: 'request_failed',
    }
    throw err
  }

  return json as T
}

export async function apiDownload(
  path: string,
  filename: string,
  token: string,
) {
  const res = await fetch(withBaseUrl(path), {
    headers: { authorization: `Bearer ${token}` },
  })
  if (!res.ok) throw new Error('download_failed')

  const blob = await res.blob()
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}
