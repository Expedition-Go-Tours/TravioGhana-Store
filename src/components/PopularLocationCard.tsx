import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import './PopularLocationCard.css'
import OptimizedImage from '@/components/shared/OptimizedImage'

interface Destination {
  title: string
  tours: string
  image: string
  region: string
}

interface PopularLocationCardProps extends Destination {
  onClick?: () => void
}

export default function PopularLocationCard({ title, tours, image, onClick }: PopularLocationCardProps) {
  const { t } = useTranslation()
  const [liked, setLiked] = useState(false)

  return (
    <div className="popular-location-card" onClick={onClick} role="link" tabIndex={0} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onClick?.() } }}>
      <div className="popular-location-image">
        <OptimizedImage src={image} alt={title} width={400} />
        <div className="popular-location-gradient" />
        <button
          className={`popular-location-heart${liked ? ' liked' : ''}`}
          onClick={(e) => { e.preventDefault(); e.stopPropagation(); setLiked(!liked) }}
          aria-label={liked ? 'Remove from wishlist' : 'Add to wishlist'}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill={liked ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
          </svg>
        </button>
        <div className="popular-location-info">
          <h3 className="popular-location-title">{title}</h3>
          <span className="popular-location-tours">{t('destinations.tours', { count: parseInt(tours) })}</span>
        </div>
      </div>
    </div>
  )
}
