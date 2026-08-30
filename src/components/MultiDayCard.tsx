import { toast } from 'sonner'
import { useTranslation } from 'react-i18next'
import i18n from '../i18n/config'
import { parsePrice, getTourSlug, type MultiDayTour } from './data'
import './MultiDayCard.css'
import { useWishlist, toWishlistItem } from '../context/WishlistContext'
import FormattedPrice from './FormattedPrice'
import OptimizedImage from '@/components/shared/OptimizedImage'

type MultiDayCardProps = MultiDayTour

export default function MultiDayCard({ id, title, days, accommodation, highlights, price, rating, reviews, location, image, source, externalUrl }: MultiDayCardProps) {
  const { t } = useTranslation()
  const { isInWishlist, addToWishlist, removeFromWishlist } = useWishlist()
  const item = toWishlistItem({ id, title, days, accommodation, highlights, price, rating: String(rating), reviews, location, image, source, externalUrl } as unknown as MultiDayTour)
  const inWishlist = isInWishlist(item.id)

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
    <div className="multiday-card" onClick={handleCardClick} onKeyDown={handleKeyDown} role="link" tabIndex={0}>
      <div className="multiday-card-image">
        {source === 'travio-ghana' && (
          <div className="source-badge">
            <img src="/travio_logo.png" alt="Travio Ghana" />
          </div>
        )}
        <OptimizedImage src={image} alt={title} width={600} />
        <div className="multiday-card-image-fade" />
        <span className="multiday-card-days">{days}</span>
        <button className={`multiday-card-wishlist${inWishlist ? ' wishlist-active' : ''}`} onClick={handleWishlist} aria-label={inWishlist ? 'Remove from wishlist' : 'Add to wishlist'}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill={inWishlist ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
          </svg>
        </button>
      </div>
      <div className="multiday-card-body">
        <div className="multiday-card-location">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
            <circle cx="12" cy="10" r="3" />
          </svg>
          {location}
        </div>
        <h3 className="multiday-card-title">{title}</h3>
        <div className="multiday-card-meta">
          <span className="multiday-card-accommodation">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
              <polyline points="9 22 9 12 15 12 15 22" />
            </svg>
            {accommodation}
          </span>
        </div>
        <div className="multiday-card-highlights">{highlights}</div>
        <div className="multiday-card-bottom">
          <div className="multiday-card-rating">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="#39AD6C" stroke="#39AD6C" strokeWidth="1">
              <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
            </svg>
            <span className="multiday-card-rating-value">{rating}</span>
            <span className="multiday-card-rating-reviews">({reviews})</span>
          </div>
          <div className="multiday-card-price">
            <span className="multiday-card-from">{t('common.from')} </span>
            <span className="multiday-card-price-value">
              <FormattedPrice usdPrice={parsePrice(price)} />
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}

