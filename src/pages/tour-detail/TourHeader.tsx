import { useTranslation } from 'react-i18next'
import { Star, MapPin, BadgeCheck, TrendingUp } from 'lucide-react'
import experienceHostBadge from '../../assets/icons/experience-host-badge.png'
import './TourHeader.css'

interface TourHeaderProps {
  title: string
  /** Combined rating (in-app + matched scraped reviews), rounded to one decimal. */
  rating?: number
  reviewCount: number
  location?: string
  supplierName?: string
  onReviewsClick: () => void
  /**
   * Trust facts derived from real rows (Sprint 1). Both are null below the
   * sample size, so a tour with one review or no recent bookings never
   * advertises a number that would embarrass it.
   */
  verifiedReviewCount?: number | null
  bookingsLast7Days?: number | null
  /**
   * The operator's marketplace totals (TripAdvisor / GetYourGuide / Google),
   * shown only when this tour has no reviews of its own. 27 of the 34 tours
   * have no matched listing, and printing "0 reviews" for them threw away the
   * 4.9 from 1,204 reviews the same operator already holds. Labelled as the
   * host's rating, never as this tour's.
   */
  operatorProof?: { rating: number | null; reviewCount: number } | null
  onOperatorReviewsClick?: () => void
}

export default function TourHeader({
  title,
  rating = 0,
  reviewCount,
  location,
  supplierName,
  onReviewsClick,
  verifiedReviewCount = null,
  bookingsLast7Days = null,
  operatorProof = null,
  onOperatorReviewsClick,
}: TourHeaderProps) {
  const { t } = useTranslation()
  // Headline value follows the "4.3 (900)" review-product convention; without
  // a rating (fresh listing) fall back to the plain count.
  const hasRating = Number.isFinite(rating) && rating > 0
  // Narrowed once so the JSX guard and the interpolation agree: the backend
  // sends null (not 0) when the sample is too small to claim anything.
  const verifiedCount = verifiedReviewCount ?? 0
  const recentBookings = bookingsLast7Days ?? 0
  const operatorCount = operatorProof?.reviewCount ?? 0
  const operatorRating = Number(operatorProof?.rating) || 0
  // Only when this tour cannot speak for itself. A tour that carries its own
  // reviews must never borrow the operator's number.
  const showOperatorProof = !hasRating && reviewCount === 0 && operatorCount > 0

  return (
    <header className="tour-header-new">
      <h1 className="tour-header-title">{title}</h1>

      <div className="tour-header-info-row">
        <div className="tour-header-info-item">
          <Star size={16} className="tour-header-info-icon tour-header-info-icon-star" />
          <span className="tour-header-info-label">{t('sections.reviews')}</span>
          <button
            type="button"
            onClick={onReviewsClick}
            className="tour-header-info-reviews-btn tour-header-info-value"
          >
            {hasRating ? (
              <span>
                {rating.toFixed(1)}
                <span className="tour-header-info-count"> ({reviewCount.toLocaleString()})</span>
              </span>
            ) : reviewCount > 0 ? (
              <span>{reviewCount.toLocaleString()} {t('sections.reviews').toLowerCase()}</span>
            ) : (
              // "0 reviews" reads as a verdict on a tour nobody has rated yet.
              // A new listing is the honest description, and the host's real
              // totals sit in the cell next door.
              <span>{t('tourDetail.newListing', 'New')}</span>
            )}
          </button>
        </div>

        <div className="tour-header-info-item">
          <MapPin size={16} className="tour-header-info-icon tour-header-info-icon-pin" />
          <span className="tour-header-info-label">{t('tourDetail.destination')}</span>
          <span className="tour-header-info-value">
            {location || t('tourDetail.defaultLocation')}
          </span>
        </div>

        {supplierName && (
          <div className="tour-header-info-item">
            <img src={experienceHostBadge} alt="" className="tour-header-info-icon tour-header-info-icon-rosette" />
            <span className="tour-header-info-label">{t('tourDetail.destinationHost')}</span>
            <span className="tour-header-info-value">
              {supplierName}
              {showOperatorProof && (
                onOperatorReviewsClick ? (
                  <button
                    type="button"
                    onClick={onOperatorReviewsClick}
                    className="tour-header-operator-proof"
                  >
                    <Star size={12} className="tour-header-operator-star" aria-hidden="true" />
                    {operatorRating > 0 && <>{operatorRating.toFixed(1)} &middot; </>}
                    {t('tourDetail.operatorReviews', '{{count}} reviews on TripAdvisor, GetYourGuide & Google', {
                      count: operatorCount,
                    })}
                  </button>
                ) : (
                  <span className="tour-header-operator-proof">
                    <Star size={12} className="tour-header-operator-star" aria-hidden="true" />
                    {operatorRating > 0 && <>{operatorRating.toFixed(1)} &middot; </>}
                    {t('tourDetail.operatorReviews', '{{count}} reviews on TripAdvisor, GetYourGuide & Google', {
                      count: operatorCount,
                    })}
                  </span>
                )
              )}
            </span>
          </div>
        )}

        {/* Trust cues: a review is only counted as verified when it came from
            an actual booking, and the booking count is the last 7 days. Both
            arrive null when the sample is too small to claim anything. */}
        {verifiedCount > 0 && (
          <div className="tour-header-info-item tour-header-info-item-wrap">
            <BadgeCheck size={16} className="tour-header-info-icon tour-header-info-icon-verified" />
            <span className="tour-header-info-label">{t('tourDetail.verifiedReviews', 'Verified')}</span>
            <span className="tour-header-info-value">
              {t('tourDetail.verifiedCount', '{{count}} verified reviews', { count: verifiedCount })}
            </span>
          </div>
        )}
        {recentBookings > 0 && (
          <div className="tour-header-info-item tour-header-info-item-wrap">
            <TrendingUp size={16} className="tour-header-info-icon tour-header-info-icon-trending" />
            <span className="tour-header-info-label">{t('tourDetail.popular', 'Popular')}</span>
            <span className="tour-header-info-value">
              {t('tourDetail.bookedRecently', 'Booked {{count}} times this week', { count: recentBookings })}
            </span>
          </div>
        )}
      </div>
    </header>
  )
}
