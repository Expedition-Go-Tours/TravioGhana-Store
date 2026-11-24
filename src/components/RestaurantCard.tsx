import { BadgeCheck, MapPin } from 'lucide-react'
import OptimizedImage from './shared/OptimizedImage'
import StarRating from './StarRating'
import type { RestaurantVenue } from '../hooks/useRestaurantVenues'
import './RestaurantCard.css'

const PRICE_LABELS: Record<number, string> = {
  1: 'Budget',
  2: 'Mid-range',
  3: 'Upscale',
  4: 'Fine dining',
}

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

interface RestaurantCardProps {
  venue: RestaurantVenue
}

export default function RestaurantCard({ venue }: RestaurantCardProps) {
  const image = venue.coverPhoto || venue.photos[0] || null
  const cuisines = venue.cuisines.slice(0, 3).join(' · ')

  return (
    <article className="restaurant-card">
      <div className="restaurant-card__media">
        {image ? (
          <OptimizedImage
            src={image}
            width={420}
            height={280}
            alt=""
            fit="crop"
            className="restaurant-card__image"
          />
        ) : (
          <div className="restaurant-card__no-image">No photo yet</div>
        )}
        {venue.featured && <span className="restaurant-card__featured">Featured</span>}
        {venue.rank?.position === 1 && (
          <span className="restaurant-card__rank">Number 1 in {venue.city ?? 'Ghana'}</span>
        )}
      </div>

      <div className="restaurant-card__body">
        <div className="restaurant-card__meta">
          <span>{cuisines || 'Restaurant'}</span>
          {venue.priceBand && <span>{PRICE_LABELS[venue.priceBand]}</span>}
        </div>

        <h2 className="restaurant-card__name">{venue.name}</h2>

        {locationLabel(venue) && (
          <p className="restaurant-card__location">
            <MapPin size={14} aria-hidden="true" />
            {locationLabel(venue)}
          </p>
        )}

        <div className="restaurant-card__rating">
          {venue.rating != null ? (
            <>
              <StarRating value={venue.rating} size={14} />
              <strong>{venue.rating.toFixed(1)}</strong>
              <span>
                {venue.reviewCount} {venue.reviewCount === 1 ? 'review' : 'reviews'}
              </span>
            </>
          ) : (
            <span>New on Travio</span>
          )}
        </div>

        {venue.verifiedReviewCount > 0 && (
          <p className="restaurant-card__verified">
            <BadgeCheck size={14} aria-hidden="true" />
            {venue.verifiedReviewCount} verified visits
          </p>
        )}

        {venue.external?.rating != null && (
          <p className="restaurant-card__external">
            {externalLabel(venue.external.source)} {venue.external.rating.toFixed(1)} ·{' '}
            {venue.external.reviewCount} external reviews
          </p>
        )}
      </div>
    </article>
  )
}
