import { lazy, Suspense } from 'react'
import { motion, useReducedMotion } from 'framer-motion'

const DotLottieReact = lazy(() =>
  import('@lottiefiles/dotlottie-react').then((m) => ({ default: m.DotLottieReact }))
)

/**
 * On-brand static fallback (also used for prefers-reduced-motion): a little
 * "our team is building this" scene so the empty state never looks broken.
 */
function StaticFallback() {
  return (
    <svg viewBox="0 0 320 240" fill="none" xmlns="http://www.w3.org/2000/svg" role="presentation" aria-hidden="true">
      <rect width="320" height="240" rx="20" fill="#f0fdf4" />
      <circle cx="252" cy="52" r="20" fill="#fef9c3" />
      <ellipse cx="72" cy="46" rx="30" ry="10" fill="white" opacity="0.5" />
      <ellipse cx="224" cy="36" rx="24" ry="8" fill="white" opacity="0.4" />
      <rect x="96" y="92" width="128" height="80" rx="10" fill="#ffffff" stroke="#bbf7d0" strokeWidth="2" />
      <rect x="110" y="106" width="46" height="6" rx="3" fill="#86efac" />
      <rect x="110" y="120" width="100" height="6" rx="3" fill="#dcfce7" />
      <rect x="110" y="134" width="76" height="6" rx="3" fill="#dcfce7" />
      <rect x="110" y="148" width="88" height="6" rx="3" fill="#dcfce7" />
      <circle cx="86" cy="176" r="12" fill="#4ade80" />
      <circle cx="86" cy="171" r="7" fill="#86efac" />
      <circle cx="160" cy="188" r="16" fill="#4ade80" />
      <circle cx="160" cy="181" r="9" fill="#86efac" />
      <circle cx="238" cy="176" r="12" fill="#4ade80" />
      <circle cx="238" cy="171" r="7" fill="#86efac" />
    </svg>
  )
}

export default function NoToursAnimation() {
  const reduce = useReducedMotion()

  if (reduce) {
    return (
      <div className="no-tours-anim">
        <StaticFallback />
      </div>
    )
  }

  return (
    <motion.div
      className="no-tours-anim"
      initial={{ opacity: 0, scale: 0.96 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.6, ease: [0.25, 0.46, 0.45, 0.94] }}
    >
      <Suspense fallback={<div style={{ width: '100%', aspectRatio: '4/3' }} />}>
        <DotLottieReact
          src="/animations/no-tours.lottie"
          loop
          autoplay
          style={{ width: '100%', height: 'auto', aspectRatio: '4/3' }}
        />
      </Suspense>
    </motion.div>
  )
}
