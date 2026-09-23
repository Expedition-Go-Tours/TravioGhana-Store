import { lazy, Suspense } from 'react'
import { motion, useReducedMotion } from 'framer-motion'

const DotLottieReact = lazy(() =>
  import('@lottiefiles/dotlottie-react').then((m) => ({ default: m.DotLottieReact }))
)

/* ── Static fallback ── */
function StaticFallback() {
  return (
    <svg viewBox="0 0 400 300" fill="none" xmlns="http://www.w3.org/2000/svg" role="presentation">
      <rect width="400" height="300" rx="16" fill="#f0fdf4" />
      <circle cx="320" cy="55" r="22" fill="#fef9c3" />
      <ellipse cx="90" cy="50" rx="35" ry="12" fill="white" opacity="0.4" />
      <ellipse cx="280" cy="40" rx="28" ry="10" fill="white" opacity="0.3" />
      <path d="M0 240 Q100 220 200 235 Q300 250 400 230 L400 300 L0 300Z" fill="#dcfce7" />
      <path d="M0 260 Q100 250 200 258 Q300 266 400 254 L400 300 L0 300Z" fill="#bbf7d0" />
      <circle cx="80" cy="240" r="14" fill="#86efac" />
      <circle cx="82" cy="234" r="10" fill="#4ade80" />
      <rect x="78" y="240" width="4" height="14" rx="1.5" fill="#92400e" opacity="0.5" />
      <circle cx="320" cy="245" r="10" fill="#86efac" />
      <circle cx="322" cy="240" r="7" fill="#4ade80" />
      <rect x="319" y="245" width="3" height="10" rx="1" fill="#92400e" opacity="0.5" />
    </svg>
  )
}

/* ── Loading shimmer ── */
function LoadingPlaceholder() {
  return (
    <div
      style={{
        width: '100%',
        aspectRatio: '4/3',
        borderRadius: 16,
        background: 'linear-gradient(135deg, #f0fdf4, #dcfce7, #f0fdf4)',
        backgroundSize: '200% 200%',
        animation: 'bk-anim-shimmer 2s ease-in-out infinite',
      }}
    />
  )
}

export default function TravelEmptyAnimation() {
  const reduce = useReducedMotion()

  if (reduce) {
    return <StaticFallback />
  }

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.96 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.6, ease: [0.25, 0.46, 0.45, 0.94] }}
      style={{ width: '100%', maxWidth: 400, margin: '0 auto' }}
    >
      <Suspense fallback={<LoadingPlaceholder />}>
        <DotLottieReact
          src="/animations/travel-empty.lottie"
          loop
          autoplay
          style={{ width: '100%', height: 'auto', aspectRatio: '4/3' }}
        />
      </Suspense>
    </motion.div>
  )
}
