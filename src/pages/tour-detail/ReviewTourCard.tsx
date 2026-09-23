import { Star, MapPin, Clock } from 'lucide-react'
import './ReviewTourCard.css'
import OptimizedImage from '@/components/shared/OptimizedImage'

interface ReviewTourCardProps {
  images: string[]
  rating: string | number
  title: string
  supplierName: string
  supplierLogo?: string
  location: string
  duration: string
}

export default function ReviewTourCard({
  images,
  rating,
  title,
  supplierName,
  supplierLogo,
  location,
  duration,
}: ReviewTourCardProps) {
  const displayImage = images[0] || ''
  const numericRating = Number(rating)
  const ratingLabel = Number.isFinite(numericRating) && numericRating > 0 ? numericRating.toFixed(1) : '0'

  return (
    <div className="review-tour-card">
      <div className="review-tour-card-image">
        {displayImage && <OptimizedImage src={displayImage} alt={title} width={400} />}
      </div>
      <div className="review-tour-card-body">
        <h3 className="review-tour-card-title">{title}</h3>

        <div className="review-tour-card-rating">
          <Star className="review-tour-card-star" size={14} fill="currentColor" />
          <span>{ratingLabel}</span>
        </div>

        <div className="review-tour-card-meta">
          {location && (
            <span className="review-tour-card-meta-item">
              <MapPin size={15} />
              {location}
            </span>
          )}
          {duration && (
            <span className="review-tour-card-meta-item">
              <Clock size={15} />
              {duration}
            </span>
          )}
        </div>

        {supplierName && (
          <div className="review-tour-card-supplier">
            {supplierLogo ? (
              <img src={supplierLogo} alt="" className="review-tour-card-supplier-logo" />
            ) : (
              <span className="review-tour-card-supplier-initial">
                {supplierName.charAt(0).toUpperCase()}
              </span>
            )}
            <span className="review-tour-card-supplier-name">{supplierName}</span>
          </div>
        )}
      </div>
    </div>
  )
}
