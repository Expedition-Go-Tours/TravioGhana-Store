import { useCallback, useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { AnimatePresence, motion } from 'framer-motion'
import { Star, ChevronLeft, ChevronRight, X } from 'lucide-react'
import { SAMPLE_TRAVELERS_LOVED } from '../../data/sampleTravelersLoved'
import './TravelersLoved.css'

export interface TravelerLovedReview {
  id: string
  name: string
  date: string
  rating: number
  title?: string
  text: string
}

interface TravelersLovedProps {
  reviews: TravelerLovedReview[]
  onViewAllReviews: () => void
}

export default function TravelersLoved({ reviews, onViewAllReviews }: TravelersLovedProps) {
  const { t } = useTranslation()
  const [modalReview, setModalReview] = useState<TravelerLovedReview | null>(null)
  const trackRef = useRef<HTMLDivElement>(null)

  const hasRealReviews = !!reviews && reviews.length > 0
  const source = hasRealReviews ? reviews : SAMPLE_TRAVELERS_LOVED

  // All reviews, highest rated first — the carousel browses through all of
  // them (not just the top three) so the arrows have somewhere to go.
  const ordered = [...source].sort((a, b) => b.rating - a.rating)

  const scrollStep = useCallback(() => {
    const el = trackRef.current
    if (!el) return 320
    const card = el.querySelector<HTMLElement>('.travelers-loved-card')
    if (!card) return 320
    const gap = parseFloat(getComputedStyle(el).columnGap) || 16
    return card.offsetWidth + gap
  }, [])

  // Close the review modal on Escape.
  useEffect(() => {
    if (!modalReview) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setModalReview(null)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [modalReview])

  const initials = (name: string) =>
    name
      .split(' ')
      .map((n) => n[0])
      .filter(Boolean)
      .join('')
      .toUpperCase()
      .substring(0, 2) || '?'

  // Move one card at a time; wrapping from either end makes the loop feel
  // continuous ("infinite in a way") instead of dead-ending at the edges.
  const scrollNext = useCallback(() => {
    const el = trackRef.current
    if (!el) return
    const maxScroll = el.scrollWidth - el.clientWidth
    if (el.scrollLeft >= maxScroll - 8) {
      el.scrollTo({ left: 0, behavior: 'smooth' })
    } else {
      el.scrollBy({ left: scrollStep(), behavior: 'smooth' })
    }
  }, [scrollStep])

  const scrollPrev = useCallback(() => {
    const el = trackRef.current
    if (!el) return
    if (el.scrollLeft <= 8) {
      el.scrollTo({ left: el.scrollWidth, behavior: 'smooth' })
    } else {
      el.scrollBy({ left: -scrollStep(), behavior: 'smooth' })
    }
  }, [scrollStep])

  return (
    <section className="travelers-loved" aria-labelledby="travelers-loved-title">
      <div className="travelers-loved-header">
        <h2 id="travelers-loved-title" className="travelers-loved-title">
          {t('tourDetail.whatTravellersLoved')}
        </h2>
        <div className="travelers-loved-arrows">
          <button type="button" className="travelers-loved-arrow" onClick={scrollPrev} aria-label="Previous reviews">
            <ChevronLeft size={18} strokeWidth={2} />
          </button>
          <button type="button" className="travelers-loved-arrow" onClick={scrollNext} aria-label="Next reviews">
            <ChevronRight size={18} strokeWidth={2} />
          </button>
        </div>
        <button type="button" className="travelers-loved-view-all" onClick={onViewAllReviews}>
          {t('tourDetail.seeAllReviews')}
        </button>
      </div>

      <div className="travelers-loved-grid" ref={trackRef}>
        {ordered.map((review) => {
          const isLong = review.text.length > 150
          return (
            <article key={review.id} className="travelers-loved-card">
              <div className="travelers-loved-card-head">
                <div className="travelers-loved-avatar">{initials(review.name)}</div>
                <div className="travelers-loved-author">
                  <div className="travelers-loved-author-name">{review.name}</div>
                  <div className="travelers-loved-meta">
                    {review.date}
                    <span className="travelers-loved-verified">· {t('tourDetail.verifiedBooking')}</span>
                  </div>
                </div>
                <div className="travelers-loved-stars" aria-label={`${review.rating} out of 5 stars`}>
                  {[1, 2, 3, 4, 5].map((star) => (
                    <Star
                      key={star}
                      size={15}
                      fill={star <= review.rating ? '#179237' : 'none'}
                      stroke={star <= review.rating ? '#179237' : '#d6d3d1'}
                    />
                  ))}
                </div>
              </div>

              {review.title && <h3 className="travelers-loved-card-title">{review.title}</h3>}

              <div className="travelers-loved-card-text collapsed">
                <p className="travelers-loved-card-paragraph">{review.text}</p>
              </div>

              {isLong && (
                <button
                  type="button"
                  className="travelers-loved-card-toggle"
                  onClick={() => setModalReview(review)}
                >
                  {t('tourDetail.seeMore')}
                </button>
              )}
            </article>
          )
        })}
      </div>

      <AnimatePresence>
        {modalReview && (
          <motion.div
            className="travelers-loved-modal-overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={() => setModalReview(null)}
          >
            <motion.div
              className="travelers-loved-modal"
              role="dialog"
              aria-modal="true"
              aria-label={`${modalReview.name} review`}
              initial={{ opacity: 0, y: 24, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 24, scale: 0.97 }}
              transition={{ type: 'spring', damping: 28, stiffness: 320 }}
              onClick={(e) => e.stopPropagation()}
            >
              <button
                type="button"
                className="travelers-loved-modal-close"
                onClick={() => setModalReview(null)}
                aria-label="Close review"
              >
                <X size={18} />
              </button>

              <div className="travelers-loved-modal-head">
                <div className="travelers-loved-avatar">{initials(modalReview.name)}</div>
                <div className="travelers-loved-modal-author">
                  <div className="travelers-loved-author-name">{modalReview.name}</div>
                  <div className="travelers-loved-meta">
                    {modalReview.date}
                    <span className="travelers-loved-verified">· {t('tourDetail.verifiedBooking')}</span>
                  </div>
                </div>
                <div className="travelers-loved-stars" aria-label={`${modalReview.rating} out of 5 stars`}>
                  {[1, 2, 3, 4, 5].map((star) => (
                    <Star
                      key={star}
                      size={16}
                      fill={star <= modalReview.rating ? '#179237' : 'none'}
                      stroke={star <= modalReview.rating ? '#179237' : '#d6d3d1'}
                    />
                  ))}
                </div>
              </div>

              {modalReview.title && <h3 className="travelers-loved-modal-title">{modalReview.title}</h3>}

              <p className="travelers-loved-modal-text">{modalReview.text}</p>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  )
}
