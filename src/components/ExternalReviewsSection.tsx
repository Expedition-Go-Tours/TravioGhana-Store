import { useRef, useState, useEffect, useLayoutEffect, useCallback, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { useReducedMotion } from 'framer-motion'
import SectionHeading from './SectionHeading'
import ExternalReviewCard from './ExternalReviewCard'
import StarRating from './StarRating'
import { useFeaturedExternalReviews, useExternalReviewStats } from '../hooks/useExternalReviews'
import { useReviewTourMatches } from '../hooks/useReviewTourMatches'
import { reviewTitleKey, selectDistinctReviews } from '../lib/reviewRail'
import useMediaQuery from '../hooks/useMediaQuery'
import useRafCallback from '../hooks/useRafCallback'
import './ExternalReviewsSection.css'

const AUTO_SCROLL_INTERVAL = 5000
/** Copies of the rail used for the endless swipe (previous / current / next). */
const LOOP_COPIES = 3

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
  const reduceMotion = useReducedMotion()
  const isHovering = useRef(false)
  const autoScrollTimer = useRef<ReturnType<typeof setInterval> | null>(null)

  // Served from the ~18 KB stats file (16 pre-picked reviews) — the full 1.6 MB
  // row dataset is only used by /reviews and the tour-detail reviews tab.
  const { data: reviews, isLoading } = useFeaturedExternalReviews()
  const { data: stats } = useExternalReviewStats()

  // One card per tour: the featured slice is picked for review quality, so it
  // repeats the same few tours heavily. Images and cards stay varied.
  const railReviews = useMemo(() => selectDistinctReviews(reviews ?? []), [reviews])
  const matches = useReviewTourMatches(railReviews)
  const looping = railReviews.length > 1

  /** The rail is rendered three times so it can swipe forever. */
  const loopedCards = useMemo(() => {
    if (!looping) {
      return railReviews.map((review) => ({ key: review.id, review, decorative: false }))
    }
    const cards: { key: string; review: (typeof railReviews)[number]; decorative: boolean }[] = []
    for (let copy = 0; copy < LOOP_COPIES; copy += 1) {
      for (const review of railReviews) {
        cards.push({
          key: `${copy}:${review.id}`,
          review,
          // The middle copy is the real one; the outer copies exist only to
          // keep the swipe continuous, so they are hidden from assistive tech.
          decorative: copy !== 1,
        })
      }
    }
    return cards
  }, [railReviews, looping])

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

    if (looping) {
      // Keep the scroll position inside the middle copy: crossing a boundary is
      // an instant jump by exactly one copy, which is visually identical.
      const setWidth = measureStep() * railReviews.length
      if (setWidth > 0) {
        if (el.scrollLeft <= 1) el.scrollLeft += setWidth
        else if (el.scrollLeft >= setWidth * 2) el.scrollLeft -= setWidth
      }
      setCanScrollLeft(true)
      setCanScrollRight(true)
      return
    }

    const maxScroll = el.scrollWidth - el.clientWidth
    setCanScrollLeft(el.scrollLeft > 5)
    setCanScrollRight(el.scrollLeft < maxScroll - 5)
  }, [looping, measureStep, railReviews.length])
  const updateArrowsRaf = useRafCallback(updateArrows)

  const scrollTo = (target: number) => {
    const el = scrollRef.current
    if (!el) return
    if (looping) {
      el.scrollTo({ left: target, behavior: 'smooth' })
      return
    }
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
    scrollTo(direction === 'left' ? current - delta : current + delta)
  }

  // Start in the middle copy so the first swipe works in both directions.
  useLayoutEffect(() => {
    const el = scrollRef.current
    if (!el || !looping) return
    const setWidth = measureStep() * railReviews.length
    if (setWidth > 0) el.scrollLeft = setWidth
  }, [looping, measureStep, railReviews.length, reviews])

  // Auto-scroll
  const startAutoScroll = useCallback(() => {
    if (autoScrollTimer.current) return
    autoScrollTimer.current = setInterval(() => {
      const el = scrollRef.current
      if (!el || isHovering.current) return
      const step = measureStep()
      if (!step) return
      scrollTo(el.scrollLeft + step)
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
  }, [updateArrows, updateArrowsRaf, railReviews])

  // A resize changes the card width (and therefore a copy's width): recentre
  // so the rail never starts outside the middle copy.
  useEffect(() => {
    const el = scrollRef.current
    if (!el || !looping || typeof ResizeObserver === 'undefined') return
    const observer = new ResizeObserver(() => {
      const setWidth = measureStep() * railReviews.length
      if (setWidth <= 0) return
      if (el.scrollLeft <= 1 || el.scrollLeft >= setWidth * 2) {
        el.scrollLeft = setWidth
      }
    })
    observer.observe(el)
    return () => observer.disconnect()
  }, [looping, measureStep, railReviews.length])

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
    if (isMobile || reduceMotion || !sectionVisible || !pageVisible || !reviews || reviews.length === 0) {
      stopAutoScroll()
      return
    }
    startAutoScroll()
    return () => stopAutoScroll()
  }, [isMobile, reduceMotion, sectionVisible, pageVisible, reviews, startAutoScroll, stopAutoScroll])

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
            <div
              className="ext-reviews-carousel"
              ref={scrollRef}
              aria-label={looping ? 'Reviews, swipe for more' : undefined}
            >
              {loopedCards.map(({ key, review, decorative }) => {
                const match = matches.get(reviewTitleKey(review.tourTitle))
                return (
                  <div key={key} className="ext-reviews-card-wrap" aria-hidden={decorative || undefined}>
                    <ExternalReviewCard
                      review={review}
                      thumbnail={match?.image ?? undefined}
                      tourHref={match?.href ?? undefined}
                      showCta={match?.cta !== 'none'}
                      decorative={decorative}
                    />
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
