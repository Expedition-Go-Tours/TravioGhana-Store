import { BadgeCheck, MapPin } from 'lucide-react'
import { Link } from 'react-router-dom'
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

function displayLabel(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1)
}

interface RestaurantCardProps {
  venue: RestaurantVenue
}

export default function RestaurantCard({ venue }: RestaurantCardProps) {
  const image = venue.coverPhoto || venue.photos[0] || null
  const cuisines = venue.cuisines.slice(0, 3).map(displayLabel).join(' · ')
  const tags = [...venue.cuisines.slice(0, 2), ...venue.dietary.slice(0, 1)].map(displayLabel)
  const to = `/restaurants/${venue.slug}`

  return (
    <article className="restaurant-card">
      <Link className="restaurant-card__link" to={to} aria-label={`View ${venue.name}`}>
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
          {venue.rank && (
            <span className="restaurant-card__rank">
              #{venue.rank.position}
              {venue.rank.of ? ` of ${venue.rank.of}` : ''}
            </span>
          )}
          {!venue.rank && venue.featured && (
            <span className="restaurant-card__featured">Featured</span>
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

          {tags.length > 0 && (
            <div className="restaurant-card__tags">
              {tags.map((tag) => (
                <span key={tag}>{tag}</span>
              ))}
            </div>
          )}

          <div className="restaurant-card__rating">
            {venue.rating != null ? (
              <>
                <StarRating value={venue.rating} size={14} ariaLabel={`${venue.rating.toFixed(1)} out of 5`} />
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
      </Link>
    </article>
  )
}
