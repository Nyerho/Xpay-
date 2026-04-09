import { useEffect, useRef, useState } from 'react'
import animationData from '../assets/lottie/loading-dots.json'

type LottieModule = {
  loadAnimation: (params: {
    container: Element
    renderer: 'svg' | 'canvas' | 'html'
    loop: boolean
    autoplay: boolean
    animationData: unknown
  }) => { destroy: () => void }
}

export function LoadingAnimation(props: { size?: number; label?: string }) {
  const size = props.size ?? 46
  const ref = useRef<HTMLDivElement | null>(null)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    let destroyed = false
    let anim: { destroy: () => void } | null = null

    import('lottie-web')
      .then((mod) => {
        if (destroyed) return
        const lottie = (mod as unknown as { default: LottieModule }).default
        if (!ref.current || !lottie?.loadAnimation) return
        anim = lottie.loadAnimation({
          container: ref.current,
          renderer: 'svg',
          loop: true,
          autoplay: true,
          animationData,
        })
      })
      .catch(() => setFailed(true))

    return () => {
      destroyed = true
      try {
        anim?.destroy()
      } catch {
        return
      }
    }
  }, [])

  return (
    <div className="d-flex flex-column align-items-center justify-content-center py-2">
      <div style={{ width: size, height: size }}>{failed ? <div className="text-muted small">…</div> : <div ref={ref} />}</div>
      {props.label ? <div className="text-muted small mt-2">{props.label}</div> : null}
    </div>
  )
}
