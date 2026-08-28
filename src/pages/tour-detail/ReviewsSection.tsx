import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { motion } from 'framer-motion'
import { Star } from 'lucide-react'
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
  photos?: string[]
  valueForMoneyRating?: number | null
  guideRating?: number | null
  meetingRating?: number | null
  travelMonth?: string | null
  companions?: string[]
  supplierResponse?: string | null
  supplierResponseAt?: string | null
  country?: string
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
}: ReviewsSectionProps) {
  const { t } = useTranslation()
  const ratingDots = Array.from({ length: 5 })
  const [expandedReviews, setExpandedReviews] = useState<Set<string>>(new Set())
  const toggleExpand = (id: string) => {
    setExpandedReviews((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  return (
    <motion.div
      key="reviews"
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -12 }}
      transition={{ duration: 0.2, ease: 'easeOut' }}
    >
      {/* Reviews Section */}
      <section className="reviews-section-content">
        <div className="reviews-header">
          <h2 className="reviews-title">{t('sections.whatTravellersAreSaying')}</h2>
          <button type="button" onClick={onWriteReview} className="reviews-write-btn">
            {t('reviews.writeAReview')}
          </button>
        </div>

        <div className="reviews-layout">
          <div className="reviews-main">
            {/* Rating Summary */}
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

            {/* Star filter clear */}
            {starFilter !== null && (
              <div className="reviews-search">
                <button
                  type="button"
                  onClick={() => onStarFilterChange(null)}
                  className="reviews-clear-filter"
                >
                  {t('reviews.clearStarFilter')}
                </button>
              </div>
            )}

            {/* Review Cards */}
            {reviews.length > 0 && (
              <div className="reviews-cards">
                {reviews.map((review) => (
                  <article key={review.id} className="review-card">
                    <p className="review-card-author">{review.name}</p>
                    <p className="review-card-date">{review.date} &bull; {review.tag || t('reviews.traveler')}</p>
                    <div className="review-card-stars">
                      {ratingDots.map((_, i) => (
                        <Star
                          key={i}
                          size={10}
                          className={i < review.rating ? 'review-star-filled-sm' : 'review-star-empty-sm'}
                        />
                      ))}
                    </div>
                    {review.title && <p className="review-card-title">{review.title}</p>}
                    <div className={`review-card-text-wrap${!expandedReviews.has(review.id) ? ' collapsed' : ' expanded'}`}>
                      <p className={`review-card-text${!expandedReviews.has(review.id) ? ' truncated' : ''}`}>
                        {review.text}
                      </p>
                    </div>
                    {review.text.length > 150 && (
                      <button
                        type="button"
                        onClick={() => toggleExpand(review.id)}
                        className="review-card-toggle"
                      >
                        {expandedReviews.has(review.id) ? t('tourDetail.seeLess') : t('tourDetail.seeMore')}
                      </button>
                    )}
                    {(review.valueForMoneyRating || review.guideRating || review.meetingRating) && (
                      <div className="review-card-subratings">
                        {review.valueForMoneyRating && <span>{t('reviews.value')}: {review.valueForMoneyRating}/5</span>}
                        {review.guideRating && <span>{t('reviews.guide')}: {review.guideRating}/5</span>}
                        {review.meetingRating && <span>{t('reviews.meeting')}: {review.meetingRating}/5</span>}
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
                    {review.photos && review.photos.length > 0 && (
                      <div className="review-card-photos">
                        {review.photos.map((url, i) => (
                          <OptimizedImage key={i} src={url} alt="" className="review-card-photo" width={400} />
                        ))}
                      </div>
                    )}
                    {review.supplierResponse && (
                      <div className="review-card-response">
                        <p className="review-card-response-title">
                          {t('reviews.responseFromSupplier')}
                          {review.supplierResponseAt && (
                            <span className="review-card-response-date">
                              {new Date(review.supplierResponseAt).toLocaleDateString('en-US', {
                                month: 'short',
                                year: 'numeric',
                              })}
                            </span>
                          )}
                        </p>
                        <p className="review-card-response-text">{review.supplierResponse}</p>
                      </div>
                    )}
                  </article>
                ))}
              </div>
            )}

            {hasMore && !starFilter && (
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
    </motion.div>
  )
}
