import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { BadgeCheck, Leaf, TrendingUp, UtensilsCrossed } from 'lucide-react'
import OptimizedImage from './shared/OptimizedImage'
import type { RestaurantVenue } from '../hooks/useRestaurantVenues'
import './TourCard.css'
import './RestaurantCard.css'

const EXTERNAL_LABELS: Record<string, string> = {
  GOOGLE: 'Google',
  TRIPADVISOR: 'Tripadvisor',
  TRIP_ADVISOR: 'Tripadvisor',
  GETYOURGUIDE: 'GetYourGuide',
  GET_YOUR_GUIDE: 'GetYourGuide',
}

function externalLabel(source: string): string {
  return EXTERNAL_LABELS[source] ?? source.replace(/_/g, ' ').toLowerCase()
}

function locationLabel(venue: RestaurantVenue): string {
  return [venue.neighbourhood, venue.city, venue.region]
    .filter((part): part is string => Boolean(part))
    .join(', ')
}

function displayLabel(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1)
}

interface RestaurantCardProps {
  venue: RestaurantVenue
}

export default function RestaurantCard({ venue }: RestaurantCardProps) {
  const navigate = useNavigate()
  const [current, setCurrent] = useState(0)
  const to = `/restaurants/${venue.slug}`

  const photos = [...new Set([venue.coverPhoto, ...venue.photos].filter(Boolean))] as string[]
  const isCarousel = photos.length > 1
  const offers = venue.offers ?? []
  const activeOffer = offers[0]
  const cuisines = venue.cuisines.map(displayLabel)
  const tags = [
    ...venue.dietary.slice(0, 2).map((item) => ({ label: displayLabel(item), kind: 'dietary' })),
    ...venue.amenities.slice(0, 2).map((item) => ({ label: displayLabel(item), kind: 'amenity' })),
  ]

  const goTo = (direction: -1 | 1) => {
    setCurrent((index) => (index + direction + photos.length) % photos.length)
  }

  const handleCardClick = (event?: React.MouseEvent) => {
    const wantsNewTab =
      event != null && (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button === 1)
    if (wantsNewTab) {
      window.open(to, '_blank', 'noopener')
      return
    }
    navigate(to)
  }

  const handleTitleClick = (event: React.MouseEvent) => {
    event.stopPropagation()
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button === 1) return
    event.preventDefault()
    navigate(to)
  }

  const handleKeyDown = (event: React.KeyboardEvent) => {
    if (event.target !== event.currentTarget) return
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      handleCardClick()
    }
  }

  return (
    <div
      className="tour-card restaurant-card"
      role="link"
      tabIndex={0}
      onClick={handleCardClick}
      onKeyDown={handleKeyDown}
      aria-label={`View ${venue.name}`}
    >
      <div className="tour-card-image">
        {activeOffer ? (
          <span
            className="tour-card-special-offer"
            title={activeOffer.title}
          >
            Special Offer
          </span>
        ) : venue.highDemand ? (
          <span
            className="tour-card-sellout-tag"
            title="Based on recent Travio diner interest, not live table availability."
          >
            <TrendingUp size={12} strokeWidth={2.4} />
            Likely to book out
          </span>
        ) : venue.featured ? (
          <span className="tour-card-new-pill">Featured</span>
        ) : null}

        {photos.length > 0 ? (
          <div
            className="tour-card-slides"
            style={{ transform: `translateX(-${current * 100}%)` }}
          >
            {photos.map((src, index) => (
              <div
                key={`${src}-${index}`}
                className={`tour-card-slide${index === current ? ' tour-card-slide-active' : ''}`}
              >
                <OptimizedImage
                  src={src}
                  alt={venue.name}
                  width={600}
                  height={400}
                  fit="crop"
                  sizes="(max-width: 640px) 78vw, (max-width: 900px) 48vw, (max-width: 1180px) 32vw, 23vw"
                  loading={index === current && index === 0 ? 'eager' : 'lazy'}
                />
              </div>
            ))}
          </div>
        ) : (
          <div className="restaurant-card__no-image">No photo yet</div>
        )}

        <div className="tour-card-image-fade" />

        {cuisines[0] && (
          <span className="tour-card-image-type-badge restaurant-card__type-badge">
            <UtensilsCrossed size={12} strokeWidth={2.4} />
            {cuisines[0]}
          </span>
        )}

        {isCarousel && (
          <>
            <button
              type="button"
              className="tour-card-arrow tour-card-arrow-prev"
              aria-label="Previous photo"
              onClick={(event) => {
                event.stopPropagation()
                goTo(-1)
              }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="15 18 9 12 15 6" />
              </svg>
            </button>
            <button
              type="button"
              className="tour-card-arrow tour-card-arrow-next"
              aria-label="Next photo"
              onClick={(event) => {
                event.stopPropagation()
                goTo(1)
              }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="9 18 15 12 9 6" />
              </svg>
            </button>
            <div className="tour-card-dots">
              {photos.map((_, index) => (
                <button
                  key={index}
                  type="button"
                  className={`tour-card-dot${index === current ? ' tour-card-dot-active' : ''}`}
                  aria-label={`Go to photo ${index + 1}`}
                  aria-current={index === current}
                  onClick={(event) => {
                    event.stopPropagation()
                    setCurrent(index)
                  }}
                />
              ))}
            </div>
          </>
        )}
      </div>

      <div className="tour-card-body">
        <div className="tour-card-location-row">
          <span className="tour-card-location">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
              <circle cx="12" cy="10" r="3" />
            </svg>
            {locationLabel(venue) || 'Ghana'}
          </span>
          {venue.rank && (
            <span className="tour-card-discount restaurant-card__rank">
              #{venue.rank.position}
            </span>
          )}
        </div>

        <h3 className="tour-card-title" title={venue.name}>
          <Link to={to} onClick={handleTitleClick}>
            {venue.name}
          </Link>
        </h3>

        <div className="tour-card-meta">
          {tags.map((tag) => (
            <span
              key={`${tag.kind}-${tag.label}`}
              className={`tour-card-badge${tag.kind === 'dietary' ? ' restaurant-card__diet-badge' : ''}`}
            >
              {tag.kind === 'dietary' && <Leaf size={12} strokeWidth={2.2} />}
              {tag.label}
            </span>
          ))}
          {venue.verifiedReviewCount > 0 && (
            <span className="tour-card-badge restaurant-card__verified-badge">
              <BadgeCheck size={12} strokeWidth={2.2} />
              {venue.verifiedReviewCount} verified
            </span>
          )}
        </div>

        <div className="tour-card-features">{cuisines.join(' · ') || 'Restaurant'}</div>

        {activeOffer && (
          <p className="restaurant-card__offer" title={activeOffer.terms ?? undefined}>
            {activeOffer.title}
          </p>
        )}

        {venue.external?.rating != null && (
          <p className="restaurant-card__external">
            {externalLabel(venue.external.source)} {venue.external.rating.toFixed(1)} ·{' '}
            {venue.external.reviewCount} external reviews
          </p>
        )}

        <div className="tour-card-bottom">
          <div className="tour-card-rating">
            <svg width="14" height="14" viewBox="0 0 24 24" fill={venue.rating != null ? '#39AD6C' : 'none'} stroke={venue.rating != null ? '#39AD6C' : '#d1d5db'} strokeWidth="1">
              <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
            </svg>
            <span className="tour-card-rating-value">
              {venue.rating != null ? venue.rating.toFixed(1) : 'New'}
            </span>
            {venue.reviewCount > 0 && (
              <span className="tour-card-rating-reviews">({venue.reviewCount})</span>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
