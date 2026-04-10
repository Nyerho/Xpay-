import { useEffect, useMemo, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { LoadingAnimation } from './LoadingAnimation'

export function RouteLoadingOverlay(props: { minMs?: number }) {
  const loc = useLocation()
  const minMs = props.minMs ?? 650
  const skip = useMemo(() => loc.pathname === '/login', [loc.pathname])
  const [visible, setVisible] = useState(() => !skip)

  useEffect(() => {
    if (skip) {
      setVisible(false)
      return
    }
    setVisible(true)
    const t = window.setTimeout(() => setVisible(false), minMs)
    return () => window.clearTimeout(t)
  }, [loc.key, minMs, skip])

  if (!visible) return null
  return (
    <div className="xpay-route-loader">
      <LoadingAnimation size={120} />
    </div>
  )
}

