import { useTranslation } from 'react-i18next'
import { Star } from 'lucide-react'
import type { ReviewStats } from '../../lib/tourTypes'
import './ReviewSummary.css'

interface ReviewSummaryProps {
  stats: ReviewStats
}

export default function ReviewSummary({ stats }: ReviewSummaryProps) {
  const { t } = useTranslation()
  const { average, total, breakdown } = stats

  const ratingLabels: Record<number, string> = {
    5: t('reviews.excellent'),
    4: t('reviews.veryGood'),
    3: t('reviews.average'),
    2: t('reviews.poor'),
    1: t('reviews.terrible'),
  }

  const getPercentage = (count: number): number => {
    return total > 0 ? (count / total) * 100 : 0
  }

  return (
    <div className="review-summary">
      <div className="review-summary-score">
        <div className="review-score-number">{average.toFixed(1)}</div>
        <div className="review-score-stars">
          {[1, 2, 3, 4, 5].map((star) => (
            <Star
              key={star}
              size={20}
              fill={star <= Math.round(average) ? '#179237' : 'none'}
              stroke={star <= Math.round(average) ? '#179237' : '#e5e4e7'}
            />
          ))}
        </div>
        <div className="review-score-label">
          {t('reviews.totalCount', { count: total })}
        </div>
      </div>

      <div className="review-summary-breakdown">
        {[5, 4, 3, 2, 1].map((rating) => (
          <div key={rating} className="review-breakdown-row">
            <span className="review-breakdown-label">{ratingLabels[rating as keyof typeof ratingLabels]}</span>
            <div className="review-breakdown-bar-container">
              <div
                className="review-breakdown-bar"
                style={{ width: `${getPercentage(breakdown[rating as keyof typeof breakdown])}%` }}
              />
            </div>
            <span className="review-breakdown-count">{breakdown[rating as keyof typeof breakdown]}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
