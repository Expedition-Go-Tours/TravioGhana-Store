import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Star, ThumbsUp } from 'lucide-react'
import { motion } from 'framer-motion'
import type { Review } from '../../lib/tourTypes'
import './ReviewList.css'

interface ReviewListProps {
  reviews: Review[]
}

export default function ReviewList({ reviews }: ReviewListProps) {
  const { t } = useTranslation()
  const [expandedReviews, setExpandedReviews] = useState<Set<string>>(new Set())
  const [visibleCount, setVisibleCount] = useState(3)

  const toggleExpanded = (reviewId: string) => {
    setExpandedReviews((prev) => {
      const newSet = new Set(prev)
      if (newSet.has(reviewId)) {
        newSet.delete(reviewId)
      } else {
        newSet.add(reviewId)
      }
      return newSet
    })
  }

  const loadMore = () => {
    setVisibleCount((prev) => Math.min(prev + 3, reviews.length))
  }

  const visibleReviews = reviews.slice(0, visibleCount)

  return (
    <div className="review-list">
      {visibleReviews.map((review, index) => {
        const isExpanded = expandedReviews.has(review.id)
        const isLongContent = review.content.length > 300

        return (
          <motion.div
            key={review.id}
            className="review-item"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.1 }}
          >
            <div className="review-header">
              <div className="review-author-info">
                <div className="review-avatar">
                  {review.author.split(' ').map(n => n[0]).join('').substring(0, 2)}
                </div>
                <div className="review-author-details">
                  <div className="review-author-name">
                    {review.author}
                    {review.verified && (
                      <span className="review-verified-badge">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#179237" strokeWidth="2.5">
                          <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                          <polyline points="22 4 12 14.01 9 11.01" />
                        </svg>
                      </span>
                    )}
                  </div>
                  <div className="review-date">{new Date(review.date).toLocaleDateString('en-US', { year: 'numeric', month: 'long' })}</div>
                </div>
              </div>
              <div className="review-stars">
                {[1, 2, 3, 4, 5].map((star) => (
                  <Star
                    key={star}
                    size={16}
                    fill={star <= review.rating ? '#179237' : 'none'}
                    stroke={star <= review.rating ? '#179237' : '#e5e4e7'}
                  />
                ))}
              </div>
            </div>

            {review.title && <h4 className="review-title">{review.title}</h4>}

            <div className={`review-content ${isExpanded ? 'expanded' : ''}`}>
              <p>{review.content}</p>
            </div>

            {isLongContent && (
              <button
                className="review-read-more"
                onClick={() => toggleExpanded(review.id)}
              >
                {isExpanded ? t('tourDetail.seeLess') : t('tourDetail.seeMore')}
              </button>
            )}

            {review.helpful && review.helpful > 0 && (
              <div className="review-helpful">
                <button className="review-helpful-btn">
                  <ThumbsUp size={16} />
                  {t('tourDetail.helpful', { count: review.helpful })}
                </button>
              </div>
            )}
          </motion.div>
        )
      })}

      {visibleCount < reviews.length && (
        <button className="review-load-more" onClick={loadMore}>
          {t('tourDetail.loadMoreReviews', { remaining: reviews.length - visibleCount })}
        </button>
      )}
    </div>
  )
}
