import { useCallback, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { motion, AnimatePresence } from 'framer-motion'
import { Star, X, ChevronLeft, ChevronRight, Camera } from 'lucide-react'
import './ReviewsSection.css'
import OptimizedImage from '@/components/shared/OptimizedImage'

interface Review {
  id: string
  name: string
  tag?: string
  date: string
  rating: number
  text: string
  title?: string | null
  avatar?: string
  bookingId?: string
  photos?: string[]
  valueForMoneyRating?: number | null
  guideRating?: number | null
  meetingRating?: number | null
  travelMonth?: string | null
  companions?: string[]
  supplierResponse?: string | null
  supplierResponseAt?: string | null
}

interface ReviewsSectionProps {
  rating: number
  reviewCount: number
  reviewBreakdown: { label: string; stars: number; count: number; percentage: number }[]
  reviews: Review[]
  hasMore: boolean
  loadingMore: boolean
  onLoadMore: () => void
  onWriteReview: () => void
  starFilter: number | null
  onStarFilterChange: (stars: number | null) => void
  supplierName?: string
  photosOnly?: boolean
  photoCount?: number
  onPhotosOnlyChange?: (value: boolean) => void
}

const VISIBLE_THUMBS = 5

function initialsOf(name: string): string {
  const parts = name
    .replace(/\s*[–—-]\s*/g, ' ')
    .trim()
    .split(/\s+/)
    .filter(Boolean)
  const letters = parts.slice(0, 2).map((p) => p[0] || '')
  return (letters.join('') || '?').toUpperCase()
}

function formatDate(iso?: string | null): string {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  return d.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
}

export default function ReviewsSection({
  rating,
  reviewCount,
  reviewBreakdown,
  reviews,
  hasMore,
  loadingMore,
  onLoadMore,
  onWriteReview,
  starFilter,
  onStarFilterChange,
  supplierName,
  photosOnly = false,
  photoCount = 0,
  onPhotosOnlyChange,
}: ReviewsSectionProps) {
  const { t } = useTranslation()
  const ratingDots = Array.from({ length: 5 })
  const [expandedReviews, setExpandedReviews] = useState<Set<string>>(new Set())
  const [gallery, setGallery] = useState<{ photos: string[]; index: number } | null>(null)

  const toggleExpand = (id: string) => {
    setExpandedReviews((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const openGallery = (photos: string[], index: number) => setGallery({ photos, index })
  const closeGallery = useCallback(() => setGallery(null), [])
  const stepGallery = useCallback((dir: 1 | -1) => {
    setGallery((prev) => {
      if (!prev || prev.photos.length <= 1) return prev
      return { ...prev, index: (prev.index + dir + prev.photos.length) % prev.photos.length }
    })
  }, [])

  // Lightbox: keyboard nav + body scroll lock while open.
  useEffect(() => {
    if (!gallery) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeGallery()
      else if (e.key === 'ArrowRight') stepGallery(1)
      else if (e.key === 'ArrowLeft') stepGallery(-1)
    }
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    window.addEventListener('keydown', onKey)
    return () => {
      document.body.style.overflow = prevOverflow
      window.removeEventListener('keydown', onKey)
    }
  }, [gallery, closeGallery, stepGallery])

  const activePhotos = reviews.some((r) => (r.photos?.length ?? 0) > 0)

  return (
    <motion.div
      key="reviews"
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -12 }}
      transition={{ duration: 0.2, ease: 'easeOut' }}
    >
      <section className="reviews-section-content">
        <div className="reviews-header">
          <h2 className="reviews-title">{t('sections.whatTravellersAreSaying')}</h2>
          <button type="button" onClick={onWriteReview} className="reviews-write-btn">
            {t('reviews.writeAReview')}
          </button>
        </div>

        <div className="reviews-layout">
          <div className="reviews-main">
            <div className="reviews-rating-summary">
              <div className="reviews-rating-score">
                <p className="reviews-rating-number">{rating.toFixed(1)}</p>
                <div className="reviews-rating-stars">
                  {ratingDots.map((_, i) => (
                    <Star key={i} size={24} className="reviews-star-filled" />
                  ))}
                </div>
                <p className="reviews-rating-label">{t('reviews.basedOn', { count: reviewCount })}</p>
              </div>
              <div className="reviews-rating-breakdown">
                {reviewBreakdown.map((item) => {
                  const isActive = starFilter === item.stars
                  return (
                    <button
                      key={item.label}
                      type="button"
                      onClick={() => onStarFilterChange(isActive ? null : item.stars)}
                      className={`reviews-breakdown-row ${isActive ? 'active' : ''}`}
                      aria-label={`Filter reviews by ${item.label}`}
                      aria-pressed={isActive}
                    >
                      <span className="reviews-breakdown-label">{item.label}</span>
                      <span className="reviews-breakdown-bar">
                        <span
                          className="reviews-breakdown-bar-fill"
                          style={{ width: `${item.percentage}%` }}
                        />
                      </span>
                      <span className="reviews-breakdown-count">{item.count}</span>
                    </button>
                  )
                })}
              </div>
            </div>

            {/* Quick filters */}
            {(starFilter !== null || activePhotos) && (
              <div className="reviews-toolbar">
                <button
                  type="button"
                  onClick={() => {
                    onStarFilterChange(null)
                    onPhotosOnlyChange?.(false)
                  }}
                  className={`reviews-filter-chip${!photosOnly && starFilter === null ? ' reviews-filter-chip-active' : ''}`}
                >
                  {t('reviews.allPhotos', 'All')}
                </button>
                {activePhotos && (
                  <button
                    type="button"
                    onClick={() => onPhotosOnlyChange?.(!photosOnly)}
                    className={`reviews-filter-chip${photosOnly ? ' reviews-filter-chip-active' : ''}`}
                  >
                    {t('reviews.withPhotos', 'With photos')}
                    {photoCount > 0 && <span className="reviews-filter-chip-count">{photoCount}</span>}
                  </button>
                )}
                {starFilter !== null && (
                  <button
                    type="button"
                    onClick={() => onStarFilterChange(null)}
                    className="reviews-clear-filter"
                  >
                    {t('reviews.clearStarFilter')}
                  </button>
                )}
              </div>
            )}

            {/* Review Cards */}
            {reviews.length > 0 && (
              <div className="reviews-cards">
                {reviews.map((review) => {
                  const isExpanded = expandedReviews.has(review.id)
                  const hasPhotos = (review.photos?.length ?? 0) > 0
                  return (
                    <article key={review.id} className="review-card">
                      <div className="review-card-stars" aria-label={`${review.rating} out of 5 stars`}>
                        {ratingDots.map((_, i) => (
                          <Star
                            key={i}
                            size={16}
                            className={i < review.rating ? 'review-star-filled-sm' : 'review-star-empty-sm'}
                          />
                        ))}
                      </div>

                      <div className="review-card-head">
                        {review.avatar ? (
                          <img
                            src={review.avatar}
                            alt=""
                            className="review-avatar review-avatar-img"
                            loading="lazy"
                          />
                        ) : (
                          <span className="review-avatar review-avatar-initials" aria-hidden="true">
                            {initialsOf(review.name)}
                          </span>
                        )}
                        <div className="review-card-head-text">
                          <p className="review-card-author">{review.name}</p>
                          <p className="review-card-date">
                            {review.date}
                            {review.bookingId && (
                              <span className="review-verified"> · {t('reviews.verifiedBooking', 'Verified booking')}</span>
                            )}
                          </p>
                        </div>
                      </div>

                      {review.title && <p className="review-card-title">{review.title}</p>}
                      <div className={`review-card-text-wrap${isExpanded ? ' expanded' : ' collapsed'}`}>
                        <p className={`review-card-text${isExpanded ? '' : ' truncated'}`}>{review.text}</p>
                      </div>
                      {review.text.length > 150 && (
                        <button
                          type="button"
                          onClick={() => toggleExpand(review.id)}
                          className="review-card-toggle"
                        >
                          {isExpanded ? t('tourDetail.seeLess') : t('tourDetail.seeMore')}
                        </button>
                      )}

                      {(review.valueForMoneyRating || review.guideRating || review.meetingRating) && (
                        <div className="review-card-subratings">
                          {review.valueForMoneyRating != null && review.valueForMoneyRating > 0 && (
                            <span className="review-subrating-chip">{t('reviews.value')}: {review.valueForMoneyRating}/5</span>
                          )}
                          {review.guideRating != null && review.guideRating > 0 && (
                            <span className="review-subrating-chip">{t('reviews.guide')}: {review.guideRating}/5</span>
                          )}
                          {review.meetingRating != null && review.meetingRating > 0 && (
                            <span className="review-subrating-chip">{t('reviews.meeting')}: {review.meetingRating}/5</span>
                          )}
                        </div>
                      )}
                      {(review.travelMonth || (review.companions && review.companions.length > 0)) && (
                        <div className="review-card-tags">
                          {review.travelMonth && <span className="review-tag">{review.travelMonth}</span>}
                          {review.companions?.map((c) => (
                            <span key={c} className="review-tag">{c}</span>
                          ))}
                        </div>
                      )}

                      {hasPhotos && (
                        <div className="review-card-photos" role="group" aria-label="Review photos">
                          {(review.photos as string[]).slice(0, VISIBLE_THUMBS).map((url, i) => (
                            <button
                              key={i}
                              type="button"
                              onClick={() => openGallery(review.photos as string[], i)}
                              className="review-photo-btn"
                              aria-label={`Open review photo ${i + 1}`}
                            >
                              <OptimizedImage src={url} alt="" className="review-card-photo" width={220} />
                            </button>
                          ))}
                          {(review.photos as string[]).length > VISIBLE_THUMBS && (
                            <button
                              type="button"
                              onClick={() => openGallery(review.photos as string[], VISIBLE_THUMBS)}
                              className="review-photo-btn review-photo-more"
                              aria-label="View all review photos"
                            >
                              <Camera size={16} />
                              +{(review.photos as string[]).length - VISIBLE_THUMBS}
                            </button>
                          )}
                        </div>
                      )}

                      {review.supplierResponse && (
                        <div className="review-card-response">
                          <p className="review-card-response-title">
                            {t('reviews.responseFromSupplier', 'Response from supplier')}
                            {supplierName ? ` · ${supplierName}` : ''}
                          </p>
                          {review.supplierResponseAt && (
                            <p className="review-card-response-date">{formatDate(review.supplierResponseAt)}</p>
                          )}
                          <p className="review-card-response-text">{review.supplierResponse}</p>
                        </div>
                      )}
                    </article>
                  )
                })}
              </div>
            )}

            {hasMore && !starFilter && !photosOnly && (
              <button
                type="button"
                onClick={onLoadMore}
                disabled={loadingMore}
                className="reviews-load-more"
              >
                {loadingMore ? t('common.loading') : t('reviews.loadMore')}
              </button>
            )}
          </div>
        </div>
      </section>

      {/* Fullscreen photo lightbox */}
      <AnimatePresence>
        {gallery && gallery.photos.length > 0 && (
          <motion.div
            key="review-lightbox"
            className="review-lightbox"
            role="dialog"
            aria-modal="true"
            aria-label="Review photo viewer"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={closeGallery}
          >
            <button type="button" className="review-lightbox-close" onClick={closeGallery} aria-label="Close">
              <X size={22} />
            </button>
            {gallery.photos.length > 1 && (
              <>
                <button
                  type="button"
                  className="review-lightbox-nav review-lightbox-prev"
                  onClick={(e) => { e.stopPropagation(); stepGallery(-1) }}
                  aria-label="Previous photo"
                >
                  <ChevronLeft size={28} />
                </button>
                <button
                  type="button"
                  className="review-lightbox-nav review-lightbox-next"
                  onClick={(e) => { e.stopPropagation(); stepGallery(1) }}
                  aria-label="Next photo"
                >
                  <ChevronRight size={28} />
                </button>
              </>
            )}
            <motion.div
              key={gallery.index}
              className="review-lightbox-slide"
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.18, ease: 'easeOut' }}
              onClick={(e) => e.stopPropagation()}
            >
              <OptimizedImage
                src={gallery.photos[gallery.index]}
                alt={`Review photo ${gallery.index + 1} of ${gallery.photos.length}`}
                className="review-lightbox-img"
                width={1400}
              />
              <p className="review-lightbox-count">
                {gallery.index + 1} / {gallery.photos.length}
              </p>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )
}
