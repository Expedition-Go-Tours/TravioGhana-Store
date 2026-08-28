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
  const ratingLabel = Number.isFinite(numericRating) ? numericRating.toFixed(1) : '—'

  return (
    <div className="review-tour-card">
      <div className="review-tour-card-image">
        {displayImage && <OptimizedImage src={displayImage} alt={title} width={400} />}
      </div>
      <div className="review-tour-card-body">
        <h3 className="review-tour-card-title">{title}</h3>
        <div className="review-tour-card-supplier-row">
          <div className="review-tour-card-rating">
            <Star className="review-tour-card-star" size={16} fill="currentColor" />
            <span>{ratingLabel}</span>
          </div>
          <div className="review-tour-card-supplier">
            {supplierLogo && (
              <OptimizedImage src={supplierLogo} alt="" className="review-tour-card-supplier-logo" width={100} />
            )}
            <span>{supplierName}</span>
          </div>
        </div>
        <div className="review-tour-card-meta">
          {location && (
            <span className="review-tour-card-meta-item">
              <MapPin size={16} />
              {location}
            </span>
          )}
          {duration && (
            <span className="review-tour-card-meta-item">
              <Clock size={16} />
              {duration}
            </span>
          )}
        </div>
      </div>
    </div>
  )
}
