import { useState, useRef, useCallback, useEffect, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { motion } from 'framer-motion'
import {
  Star, Check, ChevronLeft, ChevronRight,
} from 'lucide-react'
import { Link } from 'react-router-dom'
import './OverviewSection.css'

interface OverviewSectionProps {
  descriptionSteps: { title: string; body: ReactNode }[]
  descriptionLong?: boolean
  highlights: string[]
  reviews: {
    id: string
    name: string
    date: string
    rating: number
    text: string
    country?: string
  }[]
  onTabChange: (tab: string) => void
  onReviewReadMore: (review: any) => void
}

export default function OverviewSection({
  descriptionSteps,
  descriptionLong = false,
  highlights,
  reviews,
  onTabChange,
  onReviewReadMore,
}: OverviewSectionProps) {
  const { t } = useTranslation()
  const [fullDescriptionExpanded, setFullDescriptionExpanded] = useState(false)
  const travellersLovedRef = useRef<HTMLDivElement>(null)
  const [showLeftArrow, setShowLeftArrow] = useState(false)
  const [showRightArrow, setShowRightArrow] = useState(true)
  // Mobile swipe hint (parity with the quick-facts carousel): active-card
  // dot under the cards + a right-edge chevron. Desktop keeps its side arrows.
  const [activeDot, setActiveDot] = useState(0)

  const displayReviews = reviews.slice(0, 8)

  const handleTravellersScroll = useCallback(() => {
    const el = travellersLovedRef.current
    if (!el) return
    setShowLeftArrow(el.scrollLeft > 4)
    setShowRightArrow(el.scrollLeft < el.scrollWidth - el.clientWidth - 4)
    if (displayReviews.length > 0) {
      const cardStep = el.scrollWidth / displayReviews.length
      const cardIndex = Math.round(el.scrollLeft / cardStep)
      setActiveDot(Math.min(displayReviews.length - 1, Math.max(0, cardIndex)))
    }
  }, [displayReviews.length])

  const scrollLeft = useCallback(() => {
    travellersLovedRef.current?.scrollBy({ left: -960, behavior: 'smooth' })
  }, [])

  const scrollRight = useCallback(() => {
    travellersLovedRef.current?.scrollBy({ left: 960, behavior: 'smooth' })
  }, [])

  // Right-edge mobile hint: nudge one card forward (matches the snap rhythm).
  const scrollTravellersForward = useCallback(() => {
    const el = travellersLovedRef.current
    if (!el || displayReviews.length === 0) return
    el.scrollBy({ left: el.scrollWidth / displayReviews.length, behavior: 'smooth' })
  }, [displayReviews.length])

  const scrollTravellersTo = useCallback((index: number) => {
    const el = travellersLovedRef.current
    if (!el || displayReviews.length === 0) return
    const maxScroll = el.scrollWidth - el.clientWidth
    el.scrollTo({
      left: Math.min(index * (el.scrollWidth / displayReviews.length), maxScroll),
      behavior: 'smooth',
    })
  }, [displayReviews.length])

  // Reset the indicator when the review set changes and re-measure after
  // layout settles (mount, fonts, orientation change).
  useEffect(() => {
    setActiveDot(0)
    const raf = requestAnimationFrame(() => handleTravellersScroll())
    const wrap = travellersLovedRef.current?.parentElement
    let ro: ResizeObserver | null = null
    if (typeof ResizeObserver !== 'undefined' && wrap) {
      ro = new ResizeObserver(() => handleTravellersScroll())
      ro.observe(wrap)
    }
    window.addEventListener('resize', handleTravellersScroll)
    return () => {
      cancelAnimationFrame(raf)
      ro?.disconnect()
      window.removeEventListener('resize', handleTravellersScroll)
    }
  }, [displayReviews.length, handleTravellersScroll])

  const avatarColors = ['bg-amber-600', 'bg-emerald-600', 'bg-blue-600', 'bg-rose-500', 'bg-violet-600', 'bg-orange-500']

  return (
    <section className="overview-section">
      {/* What Travellers Loved */}
      {displayReviews.length > 0 && (
        <section className="overview-travellers">
          <div className="overview-travellers-header">
            <h2 className="overview-travellers-title">{t('tourDetail.whatTravellersLoved')}</h2>
            <Link
              to="#reviews"
              onClick={() => onTabChange('reviews')}
              className="overview-travellers-link"
            >
              {t('tourDetail.seeAllReviews')}
            </Link>
          </div>
          <div className="overview-travellers-scroll-wrapper">
            {showLeftArrow && (
              <button
                type="button"
                onClick={scrollLeft}
                className="overview-travellers-arrow left"
                aria-label="Scroll left"
              >
                <ChevronLeft size={20} />
              </button>
            )}
            <div
              ref={travellersLovedRef}
              className="overview-travellers-scroll"
              onScroll={handleTravellersScroll}
            >
              {displayReviews.map((review, idx) => {
                const initials = review.name
                  .split(' ')
                  .map((n) => n[0])
                  .join('')
                  .slice(0, 2)
                  .toUpperCase()
                const avatarColor = avatarColors[idx % avatarColors.length]

                return (
                  <article key={review.id} className="overview-traveller-card">
                    <div className="overview-traveller-card-header">
                      <div className={`overview-traveller-avatar ${avatarColor}`}>
                        {initials}
                      </div>
                      <div>
                        <p className="overview-traveller-name">{review.name}</p>
                        <div className="overview-traveller-meta">
                          <span>{review.date}</span>
                          <span className="overview-traveller-verified">
                            <Check size={10} strokeWidth={3} />
                            {t('tourDetail.verifiedBooking')}
                          </span>
                        </div>
                      </div>
                    </div>
                    <div className="overview-traveller-stars">
                      {[...Array(5)].map((_, i) => (
                        <Star
                          key={i}
                          size={14}
                          className={i < review.rating ? 'star-filled' : 'star-empty'}
                        />
                      ))}
                    </div>
                    <p className="overview-traveller-text">{review.text}</p>
                    <button
                      type="button"
                      onClick={() => onReviewReadMore(review)}
                      className="overview-traveller-readmore"
                    >
                      {t('stories.readMore')}
                    </button>
                  </article>
                )
              })}
            </div>
            {showRightArrow && (
              <button
                type="button"
                onClick={scrollRight}
                className="overview-travellers-arrow right"
                aria-label="Scroll right"
              >
                <ChevronRight size={20} />
              </button>
            )}

            <button
              type="button"
              className={`overview-travellers-hint${showRightArrow ? '' : ' overview-travellers-hint-hidden'}`}
              onClick={scrollTravellersForward}
              aria-label="Scroll reviews"
            >
              <ChevronRight size={18} strokeWidth={2.5} />
            </button>
          </div>

          {displayReviews.length > 1 && (
            <div className="overview-travellers-dots">
              {displayReviews.map((_, i) => (
                <button
                  key={i}
                  type="button"
                  className={`overview-travellers-dot${activeDot === i ? ' overview-travellers-dot-active' : ''}`}
                  onClick={() => scrollTravellersTo(i)}
                  aria-label={`Go to review ${i + 1}`}
                  aria-current={activeDot === i}
                />
              ))}
            </div>
          )}
        </section>
      )}

      {/* Highlights */}
      {highlights.length > 0 && (
        <section className="overview-highlights">
          <h2 className="overview-section-title">{t('tourDetail.highlights')}</h2>
          <ul className="overview-highlights-list">
            {highlights.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </section>
      )}

      {/* Full Description */}
      {descriptionSteps.length > 0 && (
        <section className="overview-description">
          <h2 className="overview-section-title">{descriptionSteps[0].title}</h2>
          <div className="overview-description-content">
            <motion.div
              className="overview-description-collapse"
              initial={false}
              animate={{ height: fullDescriptionExpanded || !descriptionLong ? 'auto' : 150 }}
              transition={{ duration: 0.3, ease: 'easeInOut' }}
              style={{ overflow: 'hidden' }}
            >
              <ol className="overview-description-list">
                {descriptionSteps.map((step) => (
                  <li key={step.title}>
                    {descriptionSteps.length > 1 && (
                      <p className="overview-description-step-title">{step.title}</p>
                    )}
                    <div className="overview-description-step-body">{step.body}</div>
                  </li>
                ))}
              </ol>
              {descriptionLong && !fullDescriptionExpanded && (
                <div className="overview-description-fade" />
              )}
            </motion.div>
            {descriptionLong && (
              <button
                type="button"
                onClick={() => setFullDescriptionExpanded((v) => !v)}
                className="overview-description-toggle"
              >
                {fullDescriptionExpanded ? t('tourDetail.seeLess') : t('tourDetail.seeMore')}
              </button>
            )}
          </div>
        </section>
      )}
    </section>
  )
}
