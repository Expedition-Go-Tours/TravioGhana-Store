import { lazy, Suspense, useCallback, useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from 'react'
import { createPortal } from 'react-dom'
import { motion } from 'framer-motion'
import type { DotLottie } from '@lottiefiles/dotlottie-react'
import { isMobileViewport, prefersReducedData, prefersReducedMotion } from '../lib/perfProfile'
import './BookingTransition.css'

/**
 * Full-screen transition played between clicking "Book Now" and landing on the
 * booking page. Shows a Lottie animation with a caption and progress bar.
 *
 * Rendered via a portal to <body> so it sits above the navbar and all page
 * chrome (gallery buttons, share, wishlist, etc.).
 *
 * Performance:
 * - `warmBookingTransition()` is called by BookingWidget on idle / button
 *   hover / focus / touch: it downloads this chunk, boots the dotLottie player
 *   and decodes the session's animation off-screen, so when the overlay mounts
 *   the Lottie is already there instead of appearing late.
 * - The animation plays on phones too. The only opt-out is an explicit
 *   `prefers-reduced-motion` preference; constrained profiles (phone /
 *   reduced data) use the smallest animation file.
 * - Every repeating animation (loader spin, dots, progress) runs in CSS on the
 *   compositor; framer-motion is only used for the overlay's opacity fade, so
 *   there is no per-frame JS during the transition.
 * - This component guarantees a single `onDone` even if the timer races a
 *   parent re-render.
 */

// Lazy so the ~64 KB player wrapper never lands in the booking route chunk.
// The player WASM is self-hosted (`?url` below): by default dotlottie fetches
// it from jsDelivr at runtime, which can be blocked or slow — in that case the
// animation would never appear and the overlay would sit on the CSS fallback.
// Only fetched when this chunk is actually used, versioned + cache-busted by
// Vite, and served from our own origin.
const DotLottieReact = lazy(() =>
  Promise.all([
    import('@lottiefiles/dotlottie-react'),
    import('@lottiefiles/dotlottie-web/dotlottie-player.wasm?url'),
  ]).then(([mod, wasm]) => {
    mod.setWasmUrl(wasm.default)
    return { default: mod.DotLottieReact }
  }),
)

const REDUCED_MOTION = prefersReducedMotion()
const CONSTRAINED = isMobileViewport() || prefersReducedData()
const TOTAL_MS = CONSTRAINED ? 2200 : 2400

/** Smallest bundled animation (~10 KB) — used on constrained profiles. */
const LIGHT_ANIMATION = '/animations/vintage-car.lottie'

const ANIMATION_PATHS = [
  '/animations/vintage-car.lottie',
  '/animations/sandy-loading.lottie',
  '/animations/globe.lottie',
  '/animations/dice-roll.lottie',
]

// One animation per session: picked at module scope so the off-screen warmup
// and the real transition always decode the exact same file (and the browser
// HTTP cache serves it instantly).
const DEFAULT_ANIMATION = CONSTRAINED
  ? LIGHT_ANIMATION
  : ANIMATION_PATHS[Math.floor(Math.random() * ANIMATION_PATHS.length)]

let warmPlayer: WarmedPlayer | null = null
let warmPromise: Promise<WarmedPlayer | null> | null = null

interface WarmedPlayer {
  canvas: HTMLCanvasElement
  player: DotLottie
  ready: boolean
}

/**
 * Boots the dotLottie WASM and decodes the session animation off-screen.
 * Called by BookingWidget on idle / button hover / focus / touch, so the
 * overlay can adopt the already-decoded player the instant Book Now is
 * pressed — the Lottie is on screen from the first frame, with no CSS
 * fallback spinner and no late animation.
 */
export function warmBookingTransition(): void {
  if (REDUCED_MOTION || warmPromise) return
  warmPromise = Promise.all([
    // The player class lives in the engine package — the React wrapper does
    // not re-export it at runtime, and `new` on an undefined export used to
    // make this warmup fail silently.
    import('@lottiefiles/dotlottie-web'),
    import('@lottiefiles/dotlottie-web/dotlottie-player.wasm?url'),
  ])
    .then(([web, wasm]) => {
      web.DotLottie.setWasmUrl(wasm.default)
      // 2× the largest display box (320px) so the canvas stays crisp.
      const canvas = document.createElement('canvas')
      canvas.width = 640
      canvas.height = 640
      const player = new web.DotLottie({
        canvas,
        src: DEFAULT_ANIMATION,
        autoplay: false,
        loop: true,
      })
      const state: WarmedPlayer = { canvas, player, ready: false }
      player.addEventListener('load', () => {
        state.ready = true
      })
      warmPlayer = state
      return state
    })
    .catch(() => null)
}

/** Hand the warmed player to the overlay (null when warmup hasn't happened). */
export function takeWarmedPlayer(): WarmedPlayer | null {
  return warmPlayer
}

/** True once the warmed animation has decoded its first frame. */
function isWarmedPlayerReady(): boolean {
  return !!warmPlayer?.ready
}

/** Move the warmed canvas into the overlay and start playback. */
function mountWarmedPlayer(host: HTMLElement): void {
  if (!warmPlayer) return
  const { canvas, player } = warmPlayer
  canvas.style.width = '100%'
  canvas.style.height = '100%'
  canvas.style.display = 'block'
  host.appendChild(canvas)
  player.play()
}

/** Pause the warmed player when the overlay goes away. */
function unmountWarmedPlayer(): void {
  warmPlayer?.player.pause()
}

/** Run `cb` when the warmed player finishes loading; returns an unsubscribe. */
function onWarmedPlayerLoad(cb: () => void): () => void {
  const player = warmPlayer?.player
  if (!player) return () => {}
  player.addEventListener('load', cb)
  return () => player.removeEventListener('load', cb)
}

/** Free the warmed player once the transition has actually played out. */
function releaseWarmedPlayer(): void {
  warmPlayer?.player.destroy()
  warmPlayer = null
  warmPromise = null
}

interface BookingTransitionProps {
  onDone: () => void
  caption?: string
  animationSrc?: string
}

export default function BookingTransition({ onDone, caption = 'Preparing your booking', animationSrc }: BookingTransitionProps) {
  const showLottie = !REDUCED_MOTION
  // Reuse the player warmed by BookingWidget (already decoded → the animation
  // shows immediately). Falls back to the lazy player if warmup never ran.
  const [warmMode] = useState(() => showLottie && !!takeWarmedPlayer())
  const [ready, setReady] = useState(() => showLottie && isWarmedPlayerReady())
  const [selectedAnimation] = useState(() => animationSrc || DEFAULT_ANIMATION)
  const warmHostRef = useRef<HTMLDivElement | null>(null)

  // Move the warmed canvas into the overlay before the first paint so the
  // animation (not the CSS fallback) is what the user sees.
  useLayoutEffect(() => {
    const host = warmHostRef.current
    if (!warmMode || !host) return
    mountWarmedPlayer(host)
    if (ready) {
      return () => unmountWarmedPlayer()
    }
    // Load can still be in flight if the click beat the warmup.
    const off = onWarmedPlayerLoad(() => setReady(true))
    return () => {
      off()
      unmountWarmedPlayer()
    }
  }, [warmMode, ready])

  // Reveal the animation only once the player has actually decoded its first
  // frame — `dotLottieRefCallback` fires when the instance is created, which
  // can be before the WASM/asset load finishes. (Fallback player path only.)
  const handlePlayerRef = useCallback((dotLottie: DotLottie | null) => {
    if (!dotLottie) return
    if (dotLottie.isLoaded) {
      setReady(true)
      return
    }
    const onLoad = () => {
      setReady(true)
      dotLottie.removeEventListener('load', onLoad)
    }
    dotLottie.addEventListener('load', onLoad)
  }, [])

  // Read onDone through a ref so a new callback identity can never restart the
  // completion timer mid-transition.
  const onDoneRef = useRef(onDone)
  useEffect(() => {
    onDoneRef.current = onDone
  }, [onDone])

  useEffect(() => {
    const timer = window.setTimeout(() => {
      releaseWarmedPlayer()
      onDoneRef.current()
    }, TOTAL_MS)
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      window.clearTimeout(timer)
      document.body.style.overflow = prevOverflow
    }
  }, [])

  const overlay = (
    <motion.div
      className="bt-overlay"
      style={{ '--bt-duration': `${TOTAL_MS}ms` } as CSSProperties}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.25, ease: 'easeOut' }}
      role="status"
    >
      <div className="bt-lottie">
        {showLottie && (
          warmMode ? (
            <div
              ref={warmHostRef}
              className={`bt-lottie-player${ready ? ' bt-lottie-player--ready' : ''}`}
            />
          ) : (
            <Suspense fallback={null}>
              <div className={`bt-lottie-player${ready ? ' bt-lottie-player--ready' : ''}`}>
                <DotLottieReact
                  src={selectedAnimation}
                  loop
                  autoplay
                  dotLottieRefCallback={handlePlayerRef}
                  style={{ width: '100%', height: '100%' }}
                />
              </div>
            </Suspense>
          )
        )}
        <div className={`bt-loader${ready && showLottie ? ' bt-loader--hidden' : ''}`} aria-hidden="true">
          <span className="bt-loader-ring" />
          <span className="bt-loader-dot" />
        </div>
      </div>

      <div className="bt-caption">
        <span>{caption}</span>
        <span className="bt-dots" aria-hidden="true">
          <span className="bt-dot" />
          <span className="bt-dot" />
          <span className="bt-dot" />
        </span>
      </div>

      <div className="bt-bar" aria-hidden="true">
        <span className="bt-bar-fill" />
      </div>
    </motion.div>
  )

  return createPortal(overlay, document.body)
}
