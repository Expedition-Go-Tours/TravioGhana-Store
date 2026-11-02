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
}: TourHeaderProps) {
  const { t } = useTranslation()
  // Headline value follows the "4.3 (900)" review-product convention; without
  // a rating (fresh listing) fall back to the plain count.
  const hasRating = Number.isFinite(rating) && rating > 0
  // Narrowed once so the JSX guard and the interpolation agree: the backend
  // sends null (not 0) when the sample is too small to claim anything.
  const verifiedCount = verifiedReviewCount ?? 0
  const recentBookings = bookingsLast7Days ?? 0

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
            ) : (
              <span>{reviewCount.toLocaleString()} {t('sections.reviews').toLowerCase()}</span>
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
            <span className="tour-header-info-value">{supplierName}</span>
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
