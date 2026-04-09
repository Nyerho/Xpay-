import Lottie from 'lottie-react'
import animationData from '../assets/lottie/loading-dots.json'

export function LoadingAnimation(props: { size?: number; label?: string }) {
  const size = props.size ?? 46
  return (
    <div className="d-flex flex-column align-items-center justify-content-center py-2">
      <div style={{ width: size, height: size }}>
        <Lottie animationData={animationData} loop autoplay />
      </div>
      {props.label ? <div className="text-muted small mt-2">{props.label}</div> : null}
    </div>
  )
}

