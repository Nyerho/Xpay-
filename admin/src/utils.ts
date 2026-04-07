export function formatCents(cents: number | null | undefined) {
  if (cents === null || cents === undefined) return ''
  return `$${(cents / 100).toFixed(2)}`
}

export function formatDate(iso: string | Date | null | undefined) {
  if (!iso) return ''
  const d = typeof iso === 'string' ? new Date(iso) : iso
  return d.toLocaleString()
}

