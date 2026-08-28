import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { useTranslation } from 'react-i18next'
import './SplashScreen.css'

/**
 * Travio Ghana animated splash screen — composed from separate elements so
 * each phase animates independently and nothing is ever cut:
 *   1. Emblem  — /logo.png rolls in from the left, scaling up as it settles
 *   2. Wordmark — "Travio Ghana Tours Limited" slides out from behind the stamp
 *   3. Flag    — inline SVG Ghana ribbon ripples continuously
 *   4. Tagline — "Your Gateway to Africa" fades in
 *
 * Runtime: exactly 3s, then onFinish() fires. Flat 2D vector, white bg.
 */

const EMBLEM_SRC = '/logo.png'
const DURATION_MS = 3000

interface SplashScreenProps {
  onFinish: () => void
}

/** Ribbon-styled Ghana flag (red / yellow + black star / green). */
function GhanaRibbon() {
  return (
    <svg className="splash-flag-svg" viewBox="0 0 120 44" aria-hidden="true">
      <defs>
        <linearGradient id="ribShade" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="rgba(0,0,0,0.18)" />
          <stop offset="0.15" stopColor="rgba(0,0,0,0)" />
          <stop offset="0.85" stopColor="rgba(0,0,0,0)" />
          <stop offset="1" stopColor="rgba(0,0,0,0.18)" />
        </linearGradient>
      </defs>
      {/* three horizontal bands with slight ribbon curve */}
      <path d="M2,8 Q60,2 118,8 L118,18 Q60,12 2,18 Z" fill="#ce1126" />
      <path d="M2,18 Q60,12 118,18 L118,28 Q60,22 2,28 Z" fill="#fcd116" />
      <path d="M2,28 Q60,22 118,28 L118,38 Q60,32 2,38 Z" fill="#179237" />
      <path d="M2,8 Q60,2 118,8 L118,38 Q60,32 2,38 Z" fill="url(#ribShade)" />
      {/* black star */}
      <path
        className="splash-flag-star"
        d="M60 15 l1.8 3.6 4 .6 -2.9 2.8 .7 4-3.6-1.9-3.6 1.9 .7-4-2.9-2.8 4-.6z"
        fill="#000"
      />
    </svg>
  )
}

export default function SplashScreen({ onFinish }: SplashScreenProps) {
  const { t } = useTranslation()
  const [emblemError, setEmblemError] = useState(false)

  useEffect(() => {
    const timer = setTimeout(onFinish, DURATION_MS)
    return () => clearTimeout(timer)
  }, [onFinish])

  return (
    <div className="splash">
      {/* soft futuristic glow */}
      <motion.div
        className="splash-glow"
        initial={{ opacity: 0, scale: 0.7 }}
        animate={{ opacity: [0, 0.6, 0.4], scale: [0.7, 1.1, 1] }}
        transition={{ duration: 2.4, ease: 'easeInOut' }}
      />

      <div className="splash-row">
        {/* Phase 1 — Emblem */}
        <motion.div
          className="splash-emblem"
          initial={{ opacity: 0, x: -240, rotate: -360, scale: 0.7 }}
          animate={{ opacity: 1, x: 0, rotate: 0, scale: 1 }}
          transition={{ duration: 0.9, ease: [0.22, 1, 0.36, 1] }}
        >
          {emblemError ? (
            <div className="splash-emblem-fallback">{t('splash.fallback')}</div>
          ) : (
            <img
              src={EMBLEM_SRC}
              alt={t('splash.alt')}
              onError={() => setEmblemError(true)}
              draggable={false}
            />
          )}
        </motion.div>

        {/* Phase 2 — Wordmark (slides out from behind the emblem) */}
        <div className="splash-textgroup">
          <motion.div
            className="splash-wordmark"
            initial={{ opacity: 0, x: '-38%' }}
            animate={{ opacity: 1, x: '0%' }}
            transition={{ delay: 0.5, duration: 0.7, ease: 'easeOut' }}
          >
            <span className="splash-word-1">{t('splash.word1')}</span>
            <span className="splash-word-2">
              {t('splash.word2')}
              {/* Phase 3 — Ghana ribbon */}
              <motion.span
                className="splash-flag"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1, skewX: [0, 6, -4, 5, 0], scaleY: [1, 1.12, 0.94, 1.06, 1] }}
                transition={{
                  opacity: { delay: 1, duration: 0.3 },
                  skewX: { delay: 1.3, duration: 1.8, repeat: Infinity, ease: 'easeInOut' },
                  scaleY: { delay: 1.3, duration: 1.8, repeat: Infinity, ease: 'easeInOut' },
                }}
              >
                <GhanaRibbon />
              </motion.span>
              {t('splash.word3')}
            </span>
          </motion.div>

          {/* Phase 5 — Tagline */}
          <motion.p
            className="splash-tagline"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 2, duration: 0.55, ease: 'linear' }}
          >
            {t('splash.tagline')}
          </motion.p>
        </div>
      </div>

      {/* Loading bar (Ghana flag colours) */}
      <motion.div
        className="splash-bar"
        initial={{ scaleX: 0 }}
        animate={{ scaleX: 1 }}
        transition={{ duration: DURATION_MS / 1000, ease: 'linear' }}
      />
    </div>
  )
}
