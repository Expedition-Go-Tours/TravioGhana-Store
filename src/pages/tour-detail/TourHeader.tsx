import { useTranslation } from 'react-i18next'
import { Star, MapPin } from 'lucide-react'
import experienceHostBadge from '../../assets/icons/experience-host-badge.png'
import './TourHeader.css'

interface TourHeaderProps {
  title: string
  reviewCount: number
  location?: string
  supplierName?: string
  onReviewsClick: () => void
}

export default function TourHeader({
  title,
  reviewCount,
  location,
  supplierName,
  onReviewsClick,
}: TourHeaderProps) {
  const { t } = useTranslation()
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
            <span>{reviewCount} {t('sections.reviews').toLowerCase()}</span>
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
      </div>
    </header>
  )
}
