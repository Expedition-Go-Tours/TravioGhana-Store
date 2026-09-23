import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import { useTranslation } from 'react-i18next'
import './SwipeCarousel.css'

interface SwipeCarouselProps {
  slides: ReactNode[]
  /** Accessible name for the carousel region. */
  label: string
  /** Optional extra class for page-specific sizing/bleed. */
  className?: string
}

/**
 * Touch-driven horizontal swipe carousel (mobile only). Uses a
 * translateX-track + touch handler pattern: vertical page scrolling is
 * preserved (touch-action: pan-y) while horizontal swipes step one card at a
 * time — no native scroll/snap quirks.
 *
 * The step distance is read from the track's computed `gap` (instead of being
 * hardcoded) and re-applied on resize/rotation, so the track never drifts out
 * of alignment when card widths change.
 */
export default function SwipeCarousel({ slides, label, className }: SwipeCarouselProps) {
  const { t } = useTranslation()
  const [index, setIndex] = useState(0)
  const trackRef = useRef<HTMLDivElement>(null)
  const touchStartX = useRef<number | null>(null)
  const swipeGuard = useRef(false)
  const count = slides.length

  // Reset to the first slide whenever the slide set changes.
  const slidesKey = String(count)
  const [prevKey, setPrevKey] = useState(slidesKey)
  if (prevKey !== slidesKey) {
    setPrevKey(slidesKey)
    setIndex(0)
  }

  const applyTransform = useCallback(() => {
    const track = trackRef.current
    const first = track?.firstElementChild as HTMLElement | null
    if (!track || !first) return
    const styles = window.getComputedStyle(track)
    const gap = Number.parseFloat(styles.columnGap || styles.gap || '0') || 0
    const step = first.offsetWidth + gap
    track.style.transform = `translateX(${-index * step}px)`
  }, [index])

  useLayoutEffect(() => {
    applyTransform()
  }, [applyTransform, count])

  // Card widths change with the viewport (orientation change, window resize),
  // so re-align the track instead of leaving it on a stale offset.
  useEffect(() => {
    window.addEventListener('resize', applyTransform)
    return () => window.removeEventListener('resize', applyTransform)
  }, [applyTransform])

  const go = useCallback(
    (delta: number) => {
      setIndex((i) => (i + delta + count) % count)
    },
    [count],
  )

  const onTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length > 1) {
      touchStartX.current = null
      return
    }
    touchStartX.current = e.touches[0]?.clientX ?? null
  }

  const onTouchEnd = (e: React.TouchEvent) => {
    const start = touchStartX.current
    touchStartX.current = null
    if (start == null) return
    const end = e.changedTouches[0]?.clientX ?? start
    const dx = end - start
    if (Math.abs(dx) > 40) {
      // A swipe ends with a click — suppress the resulting card tap so a
      // photo swipe doesn't open the lightbox.
      swipeGuard.current = true
      window.setTimeout(() => {
        swipeGuard.current = false
      }, 600)
      // Wrap around so the carousel never gets stuck at the ends.
      go(dx > 0 ? -1 : 1)
    }
  }

  return (
    <div
      className={`swipe-carousel${className ? ` ${className}` : ''}`}
      role="group"
      aria-roledescription="carousel"
      aria-label={label}
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}
      onTouchCancel={() => {
        touchStartX.current = null
      }}
      onKeyDown={(e) => {
        if (e.key === 'ArrowLeft') {
          e.preventDefault()
          go(-1)
        } else if (e.key === 'ArrowRight') {
          e.preventDefault()
          go(1)
        }
      }}
      onClickCapture={(e) => {
        if (swipeGuard.current) {
          e.stopPropagation()
          e.preventDefault()
          swipeGuard.current = false
        }
      }}
    >
      <div ref={trackRef} className="swipe-track">
        {slides.map((slide, i) => (
          <div
            key={i}
            className="swipe-slide"
            role="group"
            aria-roledescription="slide"
            aria-label={t('about.imageCounter', { current: i + 1, total: count })}
          >
            {slide}
          </div>
        ))}
      </div>
      {count > 1 && (
        <div className="swipe-dots">
          {slides.map((_, i) => (
            <button
              key={i}
              type="button"
              className={`swipe-dot${i === index ? ' active' : ''}`}
              aria-label={t('about.goToSlide', { number: i + 1 })}
              aria-current={i === index ? 'true' : undefined}
              onClick={() => setIndex(i)}
            >
              <span className="swipe-dot-mark" aria-hidden="true" />
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
