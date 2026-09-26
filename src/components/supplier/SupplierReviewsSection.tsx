import { useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import StarRating from '@/components/StarRating'
import ExternalReviewCard from '@/components/ExternalReviewCard'
import { useCarouselRail } from './useCarouselRail'
import type { SupplierReviewSummary } from '@/hooks/useExternalReviews'

interface SupplierReviewsSectionProps {
  summary: SupplierReviewSummary
  reviews: import('@/hooks/useExternalReviews').ExternalReview[]
}

const STAR_ORDER = [5, 4, 3, 2, 1] as const

/**
 * Supplier-level reviews: the score + distribution summary beside a rail of
 * the very same cards the homepage reviews section renders. "View all reviews"
 * goes to the public reviews page, matching the homepage section's link.
 */
export default function SupplierReviewsSection({ summary, reviews }: SupplierReviewsSectionProps) {
  const { t } = useTranslation()
  const railRef = useRef<HTMLDivElement>(null)
  const rail = useCarouselRail(railRef, 295, 16, reviews.length)

  const distributionTotal = summary.distribution
    ? STAR_ORDER.reduce((sum, star) => sum + (summary.distribution?.[star] ?? 0), 0)
    : 0

  return (
    <section className="supplier-reviews-section" id="reviews">
      <div className="supplier-section-head">
        <div>
          <h2>{t('supplier.reviewsHeading')}</h2>
          <p>{t('supplier.reviewsSubtitle')}</p>
        </div>
        <div className="supplier-section-actions">
          <button
            type="button"
            className="supplier-arrow-btn"
            onClick={() => rail.scroll('left')}
            disabled={!rail.canScrollLeft}
            aria-label={t('supplier.previousReviews')}
          >
            <ChevronLeft size={18} strokeWidth={2.2} />
          </button>
          <button
            type="button"
            className="supplier-arrow-btn"
            onClick={() => rail.scroll('right')}
            disabled={!rail.canScrollRight}
            aria-label={t('supplier.nextReviews')}
          >
            <ChevronRight size={18} strokeWidth={2.2} />
          </button>
          <Link to="/reviews" className="supplier-view-all">
            {t('supplier.viewAllReviews')}
          </Link>
        </div>
      </div>

      <div className="supplier-review-summary-card">
        <div className="supplier-review-summary-grid">
          <div className="supplier-review-score-block">
            <div className="supplier-review-score-line">
              <span className="supplier-review-score">
                {summary.rating != null ? summary.rating.toFixed(1) : '—'}
              </span>
              <span className="supplier-review-out-of">{t('supplier.outOf5')}</span>
            </div>
            <div className="supplier-review-score-stars">
              <StarRating
                value={summary.rating ?? 0}
                size={20}
                gap={2}
                filledColor="var(--bv-accent)"
                emptyColor="#e5e7eb"
              />
            </div>
            <div className="supplier-review-score-count">
              {t('supplier.providerReviews', { count: summary.count })}
            </div>

            {summary.distribution && distributionTotal > 0 && (
              <div className="supplier-review-bars">
                {STAR_ORDER.map((star) => {
                  const value = summary.distribution?.[star] ?? 0
                  const pct = (value / distributionTotal) * 100
                  const label = pct > 0 && pct < 1 ? '<1%' : `${Math.round(pct)}%`
                  return (
                    <div key={star} className="supplier-review-bar">
                      <span className="supplier-review-bar-star">{star}</span>
                      <div className="supplier-review-bar-track">
                        <span
                          className="supplier-review-bar-fill"
                          style={{ width: pct > 0 ? `${Math.max(pct, 2)}%` : '0%' }}
                        />
                      </div>
                      <span className="supplier-review-bar-value">{label}</span>
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          {reviews.length > 0 && (
            <div className="supplier-review-rail-clip">
              <div className="supplier-review-rail" ref={railRef}>
                {reviews.map((review) => (
                  <div key={review.id} className="supplier-review-card-wrap">
                    <ExternalReviewCard review={review} />
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </section>
  )
}
