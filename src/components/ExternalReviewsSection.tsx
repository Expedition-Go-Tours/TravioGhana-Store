import { useRef, useState, useEffect, useCallback, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import SectionHeading from './SectionHeading'
import ExternalReviewCard from './ExternalReviewCard'
import StarRating from './StarRating'
import { useFeaturedExternalReviews, useExternalReviewStats } from '../hooks/useExternalReviews'
import { useExpeditionTours } from '../hooks/useExpeditionTours'
import { resolveReviewThumbnails, selectDistinctReviews } from '../lib/reviewThumbnails'
import useMediaQuery from '../hooks/useMediaQuery'
import useRafCallback from '../hooks/useRafCallback'
import './ExternalReviewsSection.css'

const AUTO_SCROLL_INTERVAL = 5000

export default function ExternalReviewsSection() {
  const { t } = useTranslation()
  const scrollRef = useRef<HTMLDivElement>(null)
  const sectionRef = useRef<HTMLElement>(null)
  const [canScrollLeft, setCanScrollLeft] = useState(false)
  const [canScrollRight, setCanScrollRight] = useState(true)
  const [sectionVisible, setSectionVisible] = useState(false)
  const [pageVisible, setPageVisible] = useState(() =>
    typeof document === 'undefined' ? true : document.visibilityState !== 'hidden',
  )
  // Mobile users swipe the rail themselves; auto-advancing it burns CPU/battery
  // and fights touch scrolling.
  const isMobile = useMediaQuery('(max-width: 1023px)')
  const isHovering = useRef(false)
  const autoScrollTimer = useRef<ReturnType<typeof setInterval> | null>(null)

  // Served from the ~18 KB stats file (16 pre-picked reviews) — the full 1.6 MB
  // row dataset is only used by /reviews and the tour-detail reviews tab.
  const { data: reviews, isLoading } = useFeaturedExternalReviews()
  const { data: stats } = useExternalReviewStats()

  // The scraped rows carry no artwork, so the card image is borrowed from the
  // tour the review is about. This rides on the same catalogue query used by
  // the rest of the site (react-query dedupes it), and the section only mounts
  // when it is near the viewport.
  const { data: tourData } = useExpeditionTours({ limit: 50 })
  // One card per tour: the featured slice is picked for review quality, so it
  // repeats the same few tours heavily. Images and cards stay varied.
  const railReviews = useMemo(() => selectDistinctReviews(reviews ?? []), [reviews])
  const thumbnails = useMemo(
    () => resolveReviewThumbnails(railReviews, tourData?.tours ?? []),
    [railReviews, tourData],
  )

  /** One card + the rail's gap, measured from the DOM so it follows the CSS. */
  const measureStep = useCallback(() => {
    const el = scrollRef.current
    if (!el) return 0
    const first = el.querySelector<HTMLElement>('.ext-reviews-card-wrap')
    if (!first) return 0
    const gap = parseFloat(getComputedStyle(el).columnGap || '0') || 0
    return first.getBoundingClientRect().width + gap
  }, [])

  const updateArrows = useCallback(() => {
    const el = scrollRef.current
    if (!el) return
    const maxScroll = el.scrollWidth - el.clientWidth
    setCanScrollLeft(el.scrollLeft > 5)
    setCanScrollRight(el.scrollLeft < maxScroll - 5)
  }, [])
  const updateArrowsRaf = useRafCallback(updateArrows)

  const scrollTo = (target: number) => {
    const el = scrollRef.current
    if (!el) return
    const maxScroll = el.scrollWidth - el.clientWidth
    el.scrollTo({ left: Math.min(target, maxScroll), behavior: 'smooth' })
  }

  /** Advance by a full view so the arrows never leave a clipped card behind. */
  const pageStep = () => {
    const el = scrollRef.current
    const step = measureStep()
    if (!el || !step) return 0
    return step * Math.max(1, Math.round(el.clientWidth / step))
  }

  const scroll = (direction: 'left' | 'right') => {
    const el = scrollRef.current
    if (!el) return
    const delta = pageStep()
    const current = el.scrollLeft
    const next = direction === 'left' ? Math.max(0, current - delta) : current + delta
    scrollTo(next)
  }

  // Auto-scroll
  const startAutoScroll = useCallback(() => {
    if (autoScrollTimer.current) return
    autoScrollTimer.current = setInterval(() => {
      const el = scrollRef.current
      if (!el || isHovering.current) return
      const step = measureStep()
      if (!step) return
      const maxScroll = el.scrollWidth - el.clientWidth
      const atEnd = el.scrollLeft >= maxScroll - 10
      if (atEnd) {
        // Loop back to start
        scrollTo(0)
      } else {
        scrollTo(el.scrollLeft + step)
      }
    }, AUTO_SCROLL_INTERVAL)
  }, [measureStep])

  const stopAutoScroll = useCallback(() => {
    if (autoScrollTimer.current) {
      clearInterval(autoScrollTimer.current)
      autoScrollTimer.current = null
    }
  }, [])

  useEffect(() => {
    const el = scrollRef.current
    if (!el) return
    updateArrows()
    const onScroll = () => updateArrowsRaf()
    el.addEventListener('scroll', onScroll, { passive: true })
    return () => el.removeEventListener('scroll', onScroll)
  }, [updateArrows, updateArrowsRaf, reviews])

  // Track the rendered section's visibility so the ambient auto-scroll only
  // runs while it is on-screen. Re-attaches whenever the section (un)mounts.
  useEffect(() => {
    const el = sectionRef.current
    if (!el || typeof IntersectionObserver === 'undefined') return
    const io = new IntersectionObserver(
      ([entry]) => setSectionVisible(entry.isIntersecting),
      { rootMargin: '200px' },
    )
    io.observe(el)
    return () => io.disconnect()
  }, [reviews])

  useEffect(() => {
    const onVisibility = () => setPageVisible(document.visibilityState !== 'hidden')
    document.addEventListener('visibilitychange', onVisibility)
    return () => document.removeEventListener('visibilitychange', onVisibility)
  }, [])

  // Start auto-scroll when reviews load and the section is actually visible
  useEffect(() => {
    if (isMobile || !sectionVisible || !pageVisible || !reviews || reviews.length === 0) {
      stopAutoScroll()
      return
    }
    startAutoScroll()
    return () => stopAutoScroll()
  }, [isMobile, sectionVisible, pageVisible, reviews, startAutoScroll, stopAutoScroll])

  const handleMouseEnter = () => { isHovering.current = true }
  const handleMouseLeave = () => { isHovering.current = false }

  if (isLoading || !reviews || reviews.length === 0) {
    return null
  }

  return (
    <section className="ext-reviews-section" ref={sectionRef}>
      <div className="ext-reviews-container">
        <div className="ext-reviews-viewport">
          <SectionHeading
            title={t('sections.whatTravellersAreSaying')}
            viewAllLink="/reviews"
            viewAllChevron
            onScrollLeft={() => scroll('left')}
            onScrollRight={() => scroll('right')}
            disableLeft={!canScrollLeft}
            disableRight={!canScrollRight}
          />

          {/* Stats bar */}
          {stats && (
            <div className="ext-reviews-stats">
              <div className="ext-reviews-stats__rating">
                <span className="ext-reviews-stats__number">{stats.averageRating}</span>
                <div className="ext-reviews-stats__stars">
                  <StarRating
                    value={stats.averageRating ?? 0}
                    size={16}
                    gap={1}
                    filledColor="#16a34a"
                    emptyColor="#e5e7eb"
                  />
                </div>
              </div>
              <span className="ext-reviews-stats__divider" />
              <span className="ext-reviews-stats__text">
                From <strong>{stats.totalReviews}</strong> reviews
              </span>
            </div>
          )}

          <div
            className="ext-reviews-clip"
            onMouseEnter={handleMouseEnter}
            onMouseLeave={handleMouseLeave}
          >
            <div className="ext-reviews-carousel" ref={scrollRef}>
              {railReviews.map((review) => (
                <div key={review.id} className="ext-reviews-card-wrap">
                  <ExternalReviewCard review={review} thumbnail={thumbnails.get(review.id)} />
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
