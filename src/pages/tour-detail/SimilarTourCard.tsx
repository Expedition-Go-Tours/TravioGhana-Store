import { MapPin, Star, Heart, Car, Compass, Languages as LanguagesIcon, ShieldCheck, Ban } from 'lucide-react'
import { toast } from 'sonner'
import { useTranslation } from 'react-i18next'
import i18n from '../../i18n/config'
import { useWishlist, toWishlistItem } from '../../context/WishlistContext'
import { parsePrice, getTourSlug, type Tour } from '../../components/data'
import FormattedPrice from '../../components/FormattedPrice'
import { getCategoryMeta } from '../../components/categoryMeta'
import './SimilarTourCard.css'
import OptimizedImage from '@/components/shared/OptimizedImage'

interface SimilarTourCardProps extends Tour {
  discount?: string
}

export default function SimilarTourCard({ 
  id,
  title, 
  duration, 
  features, 
  price, 
  rating, 
  reviews, 
  location, 
  image,
  category,
  languages,
  difficulty,
  cancellationPolicy,
  pickupIncluded,
  meetingMode,
  source,
  externalUrl,
}: SimilarTourCardProps) {
  const { t } = useTranslation()
  const { isInWishlist, addToWishlist, removeFromWishlist } = useWishlist()
  const item = toWishlistItem({ id, title, duration, features, price, rating: String(rating), reviews, location, image, source, externalUrl } as Tour)
  const inWishlist = isInWishlist(item.id)

  const categoryMeta = getCategoryMeta(category)
  // "Guide" appended for the same reason as TourCard: makes clear this is
  // the language the tour guide conducts the experience in.
  const languageLabel = languages?.length ? `${languages.join(', ')} Guide` : ''
  const isNonRefundable = typeof cancellationPolicy === 'string' && /non[- ]?refundable/i.test(cancellationPolicy)
  const cancellationLabel = typeof cancellationPolicy === 'string' && cancellationPolicy
    ? (isNonRefundable ? 'Non-refundable' : (cancellationPolicy.toLowerCase().includes('free') ? 'Free cancellation' : cancellationPolicy))
    : ''

  const handleWishlist = (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (inWishlist) {
      removeFromWishlist(item.id)
    } else {
      addToWishlist(item)
      toast.success(i18n.t('common.addedToWishlist'))
    }
  }

  const tourSlug = getTourSlug(title)

  const handleCardClick = () => {
    window.open(`/tour/${tourSlug}`, '_blank', 'noopener')
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      handleCardClick()
    }
  }

  return (
    <div className="similar-tour-card" onClick={handleCardClick} onKeyDown={handleKeyDown} role="link" tabIndex={0}>
      <div className="similar-tour-image">
        {source === 'travio-ghana' && (
          <div className="source-badge">
            <img src="/travio_logo.png" alt="Travio Africa" />
          </div>
        )}
        <OptimizedImage src={image} alt={title} width={400} />
        <div className="similar-tour-overlay" />
        {categoryMeta && (
          <span className={`similar-tour-image-type-badge similar-tour-meta-badge-type-${categoryMeta.variant}`}>
            <categoryMeta.Icon size={12} strokeWidth={2.4} />
            {categoryMeta.label}
          </span>
        )}
        <button 
          className={`similar-tour-wishlist${inWishlist ? ' wishlist-active' : ''}`} 
          onClick={handleWishlist}
          aria-label={inWishlist ? 'Remove from wishlist' : 'Add to wishlist'}
        >
          <Heart 
            size={18} 
            fill={inWishlist ? 'currentColor' : 'none'} 
            stroke="currentColor"
            strokeWidth={2}
          />
        </button>
        <span className="similar-tour-duration">{duration}</span>
      </div>

      <div className="similar-tour-content">
        <div className="similar-tour-location">
          <MapPin size={12} strokeWidth={2.5} />
          <span>{location}</span>
        </div>

        <h3 className="similar-tour-title">{title}</h3>

        {(meetingMode === 'meeting_point' || pickupIncluded || languageLabel || cancellationLabel || difficulty) && (
          <div className="similar-tour-meta">
            {meetingMode === 'meeting_point' ? (
              <span className="similar-tour-meta-badge similar-tour-meta-badge-meeting">
                <Compass size={11} strokeWidth={2.2} />
                Meeting point
              </span>
            ) : pickupIncluded && (
              <span className="similar-tour-meta-badge similar-tour-meta-badge-pickup">
                <Car size={11} strokeWidth={2.2} />
                Pickup included
              </span>
            )}
            {languageLabel && (
              <span className="similar-tour-meta-badge similar-tour-meta-badge-language">
                <LanguagesIcon size={11} strokeWidth={2.2} />
                {languageLabel}
              </span>
            )}
            {cancellationLabel && (
              <span className={`similar-tour-meta-badge similar-tour-meta-badge-cancellation${isNonRefundable ? ' similar-tour-meta-badge-cancellation-negative' : ''}`}>
                {isNonRefundable ? <Ban size={11} strokeWidth={2.2} /> : <ShieldCheck size={11} strokeWidth={2.2} />}
                {cancellationLabel}
              </span>
            )}
            {difficulty && <span className="similar-tour-meta-badge">{difficulty.charAt(0).toUpperCase() + difficulty.slice(1)}</span>}
          </div>
        )}

        <p className="similar-tour-features">{features}</p>

        <div className="similar-tour-footer">
          <div className="similar-tour-rating">
            <Star size={14} fill="#179237" stroke="#179237" strokeWidth={1} />
            <span className="similar-tour-rating-value">{rating}</span>
            <span className="similar-tour-rating-count">({reviews})</span>
          </div>

          <div className="similar-tour-price">
            <span className="similar-tour-price-label">{t('common.from')}</span>
            <span className="similar-tour-price-value">
              <FormattedPrice usdPrice={parsePrice(price)} />
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}
