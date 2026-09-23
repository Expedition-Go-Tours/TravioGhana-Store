import { useRef, useState, useEffect, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import SectionHeading from './SectionHeading'
import ExternalReviewCard from './ExternalReviewCard'
import StarRating from './StarRating'
import { useFeaturedExternalReviews, useExternalReviewStats } from '../hooks/useExternalReviews'
import useMediaQuery from '../hooks/useMediaQuery'
import useRafCallback from '../hooks/useRafCallback'
import './ExternalReviewsSection.css'

const CARD_WIDTH = 295
const GAP = 16
const AUTO_SCROLL_INTERVAL = 3000

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

  const scroll = (direction: 'left' | 'right') => {
    const el = scrollRef.current
    if (!el) return
    const cardStep = CARD_WIDTH + GAP
    const maxScroll = el.scrollWidth - el.clientWidth
    const current = el.scrollLeft
    const next = direction === 'left'
      ? Math.max(0, current - cardStep * 3)
      : Math.min(current + cardStep * 3, maxScroll)
    scrollTo(next)
  }

  // Auto-scroll
  const startAutoScroll = useCallback(() => {
    if (autoScrollTimer.current) return
    autoScrollTimer.current = setInterval(() => {
      const el = scrollRef.current
      if (!el || isHovering.current) return
      const cardStep = CARD_WIDTH + GAP
      const maxScroll = el.scrollWidth - el.clientWidth
      const atEnd = el.scrollLeft >= maxScroll - 10
      if (atEnd) {
        // Loop back to start
        scrollTo(0)
      } else {
        scrollTo(el.scrollLeft + cardStep)
      }
    }, AUTO_SCROLL_INTERVAL)
  }, [])

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
                From <strong>{stats.totalReviews}</strong> reviews across
              </span>
              <div className="ext-reviews-stats__platforms">
                <span className="ext-reviews-stats__platform ext-reviews-stats__platform--ta">
                  <svg className="ext-reviews-stats__platform-icon" viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg">
                    <circle cx="32" cy="32" r="32" fill="#34E0A1" />
                    <g transform="translate(10, 14)">
                      <circle cx="10" cy="14" r="8" fill="#000" />
                      <circle cx="10" cy="14" r="5" fill="#34E0A1" />
                      <circle cx="10" cy="14" r="2.5" fill="#000" />
                      <circle cx="34" cy="14" r="8" fill="#000" />
                      <circle cx="34" cy="14" r="5" fill="#34E0A1" />
                      <circle cx="34" cy="14" r="2.5" fill="#000" />
                      <path d="M22 18 L20 24 L24 24 Z" fill="#000" />
                      <path d="M4 8 L8 2 L12 8" fill="none" stroke="#000" strokeWidth="2.5" strokeLinecap="round" />
                      <path d="M32 8 L36 2 L40 8" fill="none" stroke="#000" strokeWidth="2.5" strokeLinecap="round" />
                      <path d="M4 8 Q4 28 22 28 Q40 28 40 8" fill="none" stroke="#000" strokeWidth="2" />
                    </g>
                  </svg>
                  TripAdvisor
                </span>
                <span className="ext-reviews-stats__platform ext-reviews-stats__platform--gyg">
                  <svg className="ext-reviews-stats__platform-icon" viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg">
                    <rect width="64" height="64" rx="8" fill="#E63C2F" />
                    <text x="32" y="28" textAnchor="middle" fill="#fff" fontFamily="Arial Black, sans-serif" fontWeight="900" fontSize="16" letterSpacing="-0.5">GET</text>
                    <text x="32" y="44" textAnchor="middle" fill="#fff" fontFamily="Arial Black, sans-serif" fontWeight="900" fontSize="16" letterSpacing="-0.5">YOUR</text>
                    <text x="32" y="58" textAnchor="middle" fill="#fff" fontFamily="Arial Black, sans-serif" fontWeight="900" fontSize="13" letterSpacing="-0.5">GUIDE</text>
                  </svg>
                  GetYourGuide
                </span>
                <span className="ext-reviews-stats__platform ext-reviews-stats__platform--google">
                  <svg className="ext-reviews-stats__platform-icon" viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg">
                    <rect width="64" height="64" rx="12" fill="#fff" stroke="#e5e7eb" strokeWidth="1" />
                    <path d="M32 16c4.2 0 7.6 1.4 10.4 4.1l-4.3 4.3c-1.6-1.6-3.5-2.4-6.1-2.4-5.2 0-9.4 4.3-9.4 9.5s4.2 9.5 9.4 9.5c4.5 0 7.5-2.6 8.3-6.3H32v-5.6h14.8c.2.9.3 1.9.3 3.1 0 8.2-5.5 14.1-15.1 14.1C22.6 46.3 16 39.7 16 31.4S22.6 16.5 32 16.5z" fill="#4285F4"/>
                    <path d="M32 16c4.2 0 7.6 1.4 10.4 4.1l-4.3 4.3c-1.6-1.6-3.5-2.4-6.1-2.4" fill="#EA4335"/>
                    <path d="M16.9 31.4c0-2.8.8-5.4 2.1-7.6l-5.1-4C11.3 23.2 10 27.1 10 31.4s1.3 8.2 3.9 11.6l5.1-4c-1.3-2.2-2.1-4.8-2.1-7.6z" fill="#FBBC05"/>
                  </svg>
                  Google
                </span>
              </div>
            </div>
          )}
          <div
            className="ext-reviews-clip"
            onMouseEnter={handleMouseEnter}
            onMouseLeave={handleMouseLeave}
          >
            <div className="ext-reviews-carousel" ref={scrollRef}>
              {reviews.map((review) => (
                <div key={review.id} className="ext-reviews-card-wrap">
                  <ExternalReviewCard review={review} />
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
