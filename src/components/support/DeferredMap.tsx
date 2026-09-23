import { useEffect, useRef, useState } from 'react'
import { MapPin } from 'lucide-react'

interface DeferredMapProps {
  /** iframe title for accessibility (e.g. the office location label). */
  title: string
  /** Google Maps embed URL. */
  src: string
  /** Wrapper class — defaults to the support `sh-map` shell. */
  className?: string
  /** How far outside the viewport the map starts preloading. */
  rootMargin?: string
}

/**
 * Google Maps embeds are heavy (network + own JS). Mount the iframe only when
 * the card approaches the viewport, showing a shimmer placeholder that
 * occupies the same box so nothing shifts. Browsers without
 * IntersectionObserver (tests, very old browsers) load the map eagerly.
 */
export default function DeferredMap({
  title,
  src,
  className = 'sh-map',
  rootMargin = '300px',
}: DeferredMapProps) {
  const ref = useRef<HTMLDivElement>(null)
  const [inView, setInView] = useState(() => typeof IntersectionObserver === 'undefined')

  useEffect(() => {
    if (inView) return
    const el = ref.current
    if (!el) return

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setInView(true)
          observer.disconnect()
        }
      },
      { rootMargin },
    )
    observer.observe(el)
    return () => observer.disconnect()
  }, [inView, rootMargin])

  return (
    <div ref={ref} className={className}>
      {inView ? (
        <iframe
          title={title}
          src={src}
          width="100%"
          height="100%"
          style={{ border: 0 }}
          allowFullScreen
          loading="lazy"
          referrerPolicy="no-referrer-when-downgrade"
        />
      ) : (
        <div className="sh-map-skeleton" aria-hidden="true">
          <span className="sh-map-skeleton-pin">
            <MapPin size={22} aria-hidden="true" />
          </span>
        </div>
      )}
    </div>
  )
}
