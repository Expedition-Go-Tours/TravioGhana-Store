import { useMemo, useState, type FormEvent } from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import {
  BadgeCheck,
  ChevronRight,
  Clock3,
  ExternalLink,
  Flag,
  MapPin,
  Navigation,
  PenLine,
  Phone,
  ShieldCheck,
} from 'lucide-react'
import { toast } from 'sonner'
import SEO, { SITE_URL } from '../../components/SEO'
import Footer from '../../components/Footer'
import OptimizedImage from '../../components/shared/OptimizedImage'
import StarRating from '../../components/StarRating'
import { useAuthUser } from '../../hooks/useAuthUser'
import { useAuthContext } from '../../context/AuthContext'
import {
  useRestaurantVenue,
  useRestaurantVenueReviews,
  type RestaurantVenueDetail,
} from '../../hooks/useRestaurantVenues'
import {
  useMyRestaurantClaim,
  useReportRestaurantReview,
} from '../../hooks/useRestaurantActions'
import {
  displayLabel,
  formatDate,
  formatHourValue,
  locationText,
  priceLabel,
  sourceLabel,
} from './RestaurantPageBits'
import '../RestaurantsPage.css'
import './RestaurantPages.css'

const REPORT_REASONS = [
  'Not a first-hand visit',
  'Review is about a different restaurant',
  'Offensive or irrelevant content',
  'Conflict of interest',
]

function galleryImages(venue: RestaurantVenueDetail): string[] {
  return [...new Set([venue.coverPhoto, ...venue.photos].filter(Boolean) as string[])]
}

function mapHref(venue: RestaurantVenueDetail): string {
  if (venue.latitude != null && venue.longitude != null) {
    return `https://www.google.com/maps/search/?api=1&query=${venue.latitude},${venue.longitude}`
  }
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
    locationText(venue) || venue.name,
  )}`
}

function websiteHref(url: string): string {
  return /^https?:\/\//i.test(url) ? url : `https://${url}`
}

function formatHours(hours: Record<string, unknown> | null): { day: string; value: string }[] {
  if (!hours) return []
  return Object.entries(hours)
    .map(([day, value]) => ({ day: displayLabel(day.replace(/_/g, ' ')), value: formatHourValue(value) }))
    .filter((row) => row.value)
}

function FacetList({ title, values }: { title: string; values: string[] }) {
  if (!values.length) return null
  return (
    <div className="rd-facet">
      <h3>{title}</h3>
      <div className="rd-chips">
        {values.map((value) => (
          <span key={value}>{displayLabel(value)}</span>
        ))}
      </div>
    </div>
  )
}

export default function RestaurantDetailPage() {
  const { slug = '' } = useParams<{ slug: string }>()
  const [searchParams, setSearchParams] = useSearchParams()
  const user = useAuthUser()
  const { promptSignIn } = useAuthContext()
  const venueQuery = useRestaurantVenue(slug)
  const reviewsQuery = useRestaurantVenueReviews(slug)
  const claimQuery = useMyRestaurantClaim(slug, Boolean(user))
  const report = useReportRestaurantReview(slug)
  const [activePhoto, setActivePhoto] = useState(0)
  const [reportingReview, setReportingReview] = useState<string | null>(null)
  const [reportReason, setReportReason] = useState(REPORT_REASONS[0])
  const [reportDetail, setReportDetail] = useState('')

  const venue = venueQuery.data
  const images = useMemo(() => (venue ? galleryImages(venue) : []), [venue])
  const reviews = reviewsQuery.data?.pages.flatMap((page) => page.reviews) ?? []
  const distribution =
    reviewsQuery.data?.pages[0]?.distribution ?? venue?.distribution ?? null
  const distributionTotal = distribution
    ? Object.values(distribution).reduce((sum, count) => sum + Number(count || 0), 0)
    : 0
  const hours = formatHours(venue?.hours ?? null)
  const isManager = Boolean(claimQuery.data?.membership)

  if (venueQuery.isPending) {
    return (
      <div className="restaurants-page">
        <main className="restaurants-page__main">
          <div className="restaurant-skeleton" />
        </main>
        <Footer />
      </div>
    )
  }

  if (venueQuery.isError || !venue) {
    return (
      <div className="restaurants-page">
        <SEO title="Restaurant not found" robots="noindex" />
        <main className="restaurants-page__main">
          <div className="restaurants-state">
            <h1>We could not find this restaurant</h1>
            <p>The listing may have moved or is no longer published in Ghana.</p>
            <Link to="/restaurants">Browse all restaurants</Link>
          </div>
        </main>
        <Footer />
      </div>
    )
  }

  const submitReport = async (event: FormEvent<HTMLFormElement>, reviewId: string) => {
    event.preventDefault()
    if (!user) {
      promptSignIn(`/restaurants/${slug}`)
      return
    }
    try {
      await report.mutateAsync({
        reviewId,
        reason: reportReason,
        detail: reportDetail.trim() || undefined,
      })
      setReportingReview(null)
      setReportDetail('')
      toast.success('Thanks. Our moderators will review this report.')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'We could not send that report.')
    }
  }

  const dismissSubmittedNotice = () => {
    const next = new URLSearchParams(searchParams)
    next.delete('review')
    setSearchParams(next, { replace: true })
  }

  return (
    <div className="restaurants-page">
      <SEO
        title={venue.name}
        description={
          venue.description
            ? venue.description.slice(0, 155)
            : `${venue.name} in ${locationText(venue) || 'Ghana'}. See Travio diner reviews, photos and restaurant details.`
        }
        canonical={`${SITE_URL}/restaurants/${venue.slug}`}
        image={images[0]}
        jsonLd={{
          '@context': 'https://schema.org',
          '@type': 'Restaurant',
          name: venue.name,
          url: `${SITE_URL}/restaurants/${venue.slug}`,
          image: images.length ? images : undefined,
          address: {
            '@type': 'PostalAddress',
            streetAddress: venue.addressLine ?? undefined,
            addressLocality: venue.city ?? undefined,
            addressRegion: venue.region ?? undefined,
            addressCountry: venue.country ?? undefined,
          },
          telephone: venue.phone ?? undefined,
          aggregateRating:
            venue.rating != null && venue.reviewCount > 0
              ? {
                  '@type': 'AggregateRating',
                  ratingValue: venue.rating,
                  reviewCount: venue.reviewCount,
                  bestRating: 5,
                }
              : undefined,
        }}
      />

      <main className="restaurants-page__main rd-page">
        <nav className="rh-breadcrumb" aria-label="Breadcrumb">
          <Link to="/">Home</Link>
          <ChevronRight size={13} aria-hidden="true" />
          <Link to="/restaurants">Restaurants</Link>
          {venue.city && (
            <>
              <ChevronRight size={13} aria-hidden="true" />
              <Link to={`/restaurants?city=${encodeURIComponent(venue.city)}`}>{venue.city}</Link>
            </>
          )}
          <ChevronRight size={13} aria-hidden="true" />
          <span>{venue.name}</span>
        </nav>

        {searchParams.get('review') === 'submitted' && (
          <div className="rd-notice" role="status">
            <span>Your review was sent. It will appear here once our moderators clear it.</span>
            <button type="button" onClick={dismissSubmittedNotice} aria-label="Dismiss message">
              ×
            </button>
          </div>
        )}

        <header className="rd-heading">
          <div>
            <div className="rd-heading__badges">
              {venue.rank && (
                <span className="rd-rank">
                  #{venue.rank.position}
                  {venue.rank.of ? ` of ${venue.rank.of}` : ''} in {venue.city ?? 'Ghana'}
                </span>
              )}
              {venue.featured && !venue.rank && <span className="rd-rank">Featured</span>}
              {venue.verifiedReviewCount > 0 && (
                <span className="rd-verified">
                  <BadgeCheck size={14} aria-hidden="true" />
                  {venue.verifiedReviewCount} verified visits
                </span>
              )}
            </div>
            <h1>{venue.name}</h1>
            <div className="rd-heading__rating">
              {venue.rating != null ? (
                <>
                  <StarRating value={venue.rating} size={18} />
                  <strong>{venue.rating.toFixed(1)}</strong>
                  <span>{venue.reviewCount} Travio reviews</span>
                </>
              ) : (
                <span>No Travio reviews yet</span>
              )}
            </div>
            <p className="rd-heading__location">
              <MapPin size={16} aria-hidden="true" />
              {locationText(venue) || 'Location to be confirmed'}
            </p>
          </div>
          <div className="rd-heading__actions">
            <Link className="rd-primary-action" to={`/restaurants/${venue.slug}/review`}>
              <PenLine size={16} aria-hidden="true" />
              Write a review
            </Link>
            {isManager ? (
              <Link to={`/restaurants/${venue.slug}/manage`}>Manage listing</Link>
            ) : (
              <Link to={`/restaurants/${venue.slug}/claim`}>Is this your restaurant?</Link>
            )}
          </div>
        </header>

        <section className="rd-gallery" aria-label={`Photos of ${venue.name}`}>
          {images.length > 0 ? (
            <>
              <button
                type="button"
                className="rd-gallery__main"
                onClick={() => setActivePhoto((index) => (index + 1) % images.length)}
                aria-label="Show next photo"
              >
                <OptimizedImage
                  src={images[Math.min(activePhoto, images.length - 1)]}
                  alt={`${venue.name} photo ${Math.min(activePhoto, images.length - 1) + 1}`}
                  width={900}
                  height={560}
                  fit="crop"
                  sizes="(max-width: 900px) 92vw, 64vw"
                  priority
                />
              </button>
              <div className="rd-gallery__thumbs">
                {images.slice(0, 4).map((image, index) => (
                  <button
                    key={image}
                    type="button"
                    className={index === activePhoto ? 'is-active' : ''}
                    onClick={() => setActivePhoto(index)}
                    aria-label={`Show photo ${index + 1}`}
                  >
                    <OptimizedImage
                      src={image}
                      alt=""
                      width={160}
                      height={110}
                      fit="crop"
                      sizes="(max-width: 640px) 30vw, (max-width: 900px) 18vw, 15vw"
                    />
                  </button>
                ))}
              </div>
            </>
          ) : (
            <div className="rd-gallery__empty">Photos will be added when the listing is verified.</div>
          )}
        </section>

        <div className="rd-layout">
          <div className="rd-main-column">
            <section className="rd-panel" id="about">
              <h2>About {venue.name}</h2>
              {venue.description ? (
                <p>{venue.description}</p>
              ) : (
                <p>
                  We are still collecting the details for this restaurant. The listing stays live
                  without a description while we verify it with the business.
                </p>
              )}
              <FacetList title="Cuisines" values={venue.cuisines} />
              <FacetList title="Dietary options" values={venue.dietary} />
              <FacetList title="Amenities" values={venue.amenities} />
            </section>

            <section className="rd-panel" id="hours">
              <h2>Hours and location</h2>
              <div className="rd-two-columns">
                <div>
                  <h3>
                    <Clock3 size={15} aria-hidden="true" /> Opening hours
                  </h3>
                  {hours.length ? (
                    <dl className="rd-hours">
                      {hours.map((row) => (
                        <div key={row.day}>
                          <dt>{row.day}</dt>
                          <dd>{row.value}</dd>
                        </div>
                      ))}
                    </dl>
                  ) : (
                    <p>Hours have not been added yet.</p>
                  )}
                </div>
                <div>
                  <h3>
                    <MapPin size={15} aria-hidden="true" /> Getting here
                  </h3>
                  <p>{venue.addressLine || 'Street address to be confirmed'}</p>
                  <a href={mapHref(venue)} target="_blank" rel="noreferrer">
                    <Navigation size={14} aria-hidden="true" /> Open in Google Maps
                  </a>
                  {venue.phone && (
                    <p>
                      <Phone size={14} aria-hidden="true" />
                      <a href={`tel:${venue.phone.replace(/\s/g, '')}`}>{venue.phone}</a>
                    </p>
                  )}
                  {venue.website && (
                    <p>
                      <ExternalLink size={14} aria-hidden="true" />
                      <a href={websiteHref(venue.website)} target="_blank" rel="noreferrer">
                        Restaurant website
                      </a>
                    </p>
                  )}
                </div>
              </div>
            </section>

            <section className="rd-panel" id="reviews">
              <div className="rd-panel__head">
                <div>
                  <h2>Travio reviews</h2>
                  <p>
                    These stars come from people who reviewed {venue.name} on Travio. Outside scores
                    are shown separately.
                  </p>
                </div>
                <Link to={`/restaurants/${venue.slug}/review`}>Write a review</Link>
              </div>

              <div className="rd-distribution" aria-label="Rating distribution">
                {[5, 4, 3, 2, 1].map((rating) => {
                  const count = Number(distribution?.[String(rating)] ?? 0)
                  const percent = distributionTotal ? Math.round((count / distributionTotal) * 100) : 0
                  return (
                    <div key={rating} className="rd-distribution__row">
                      <span>{rating} star</span>
                      <div className="rd-distribution__bar">
                        <span style={{ width: `${percent}%` }} />
                      </div>
                      <span>{count}</span>
                    </div>
                  )
                })}
              </div>

              {reviewsQuery.isPending && <p className="rd-muted">Loading reviews…</p>}
              {reviewsQuery.isError && (
                <div className="rd-inline-state">
                  <p>We could not load reviews right now.</p>
                  <button type="button" onClick={() => void reviewsQuery.refetch()}>
                    Try again
                  </button>
                </div>
              )}

              {!reviewsQuery.isPending && !reviewsQuery.isError && reviews.length === 0 && (
                <div className="rd-inline-state">
                  <p>No Travio reviews have been published for this restaurant yet.</p>
                  <Link to={`/restaurants/${venue.slug}/review`}>Be the first to review</Link>
                </div>
              )}

              <div className="rd-reviews">
                {reviews.map((review) => (
                  <article key={review.id} className="rd-review">
                    <div className="rd-review__head">
                      <div>
                        {review.author.photoURL ? (
                          <img src={review.author.photoURL} alt="" className="rd-review__avatar" />
                        ) : (
                          <span className="rd-review__avatar rd-review__avatar--fallback">
                            {(review.author.name ?? 'D')[0]}
                          </span>
                        )}
                        <div>
                          <strong>{review.author.name ?? 'Travio diner'}</strong>
                          <span>
                            {formatDate(review.visitedAt || review.createdAt)}
                            {review.verified && (
                              <>
                                {' · '}
                                <BadgeCheck size={12} aria-hidden="true" /> Verified visit
                              </>
                            )}
                          </span>
                        </div>
                      </div>
                      <StarRating value={review.rating} size={15} />
                    </div>
                    {review.title && <h3>{review.title}</h3>}
                    {review.body && <p>{review.body}</p>}
                    {review.photos.length > 0 && (
                      <div className="rd-review__photos">
                        {review.photos.map((photo) => (
                          <OptimizedImage key={photo} src={photo} alt="" width={120} height={90} fit="crop" />
                        ))}
                      </div>
                    )}
                    <div className="rd-review__foot">
                      <button
                        type="button"
                        onClick={() => {
                          if (!user) {
                            promptSignIn(`/restaurants/${slug}`)
                            return
                          }
                          setReportingReview(review.id === reportingReview ? null : review.id)
                        }}
                      >
                        <Flag size={13} aria-hidden="true" /> Report
                      </button>
                    </div>
                    {reportingReview === review.id && (
                      <form className="rd-report-form" onSubmit={(event) => void submitReport(event, review.id)}>
                        <label>
                          Reason
                          <select value={reportReason} onChange={(event) => setReportReason(event.target.value)}>
                            {REPORT_REASONS.map((reason) => (
                              <option key={reason}>{reason}</option>
                            ))}
                          </select>
                        </label>
                        <label>
                          More detail (optional)
                          <textarea
                            value={reportDetail}
                            onChange={(event) => setReportDetail(event.target.value)}
                            rows={2}
                            maxLength={1000}
                          />
                        </label>
                        <div>
                          <button type="submit" disabled={report.isPending}>
                            {report.isPending ? 'Sending…' : 'Send report'}
                          </button>
                          <button type="button" onClick={() => setReportingReview(null)}>
                            Cancel
                          </button>
                        </div>
                      </form>
                    )}
                  </article>
                ))}
              </div>

              {reviewsQuery.hasNextPage && (
                <button
                  className="rd-load-more"
                  type="button"
                  disabled={reviewsQuery.isFetchingNextPage}
                  onClick={() => void reviewsQuery.fetchNextPage()}
                >
                  {reviewsQuery.isFetchingNextPage ? 'Loading…' : 'Show more reviews'}
                </button>
              )}
            </section>
          </div>

          <aside className="rd-sidebar">
            <section className="rd-side-card">
              <h2>Restaurant details</h2>
              <dl>
                <div>
                  <dt>Cuisine</dt>
                  <dd>{venue.cuisines.map(displayLabel).join(', ') || 'Not listed yet'}</dd>
                </div>
                <div>
                  <dt>Price</dt>
                  <dd>{priceLabel(venue.priceBand) || 'Not listed yet'}</dd>
                </div>
                <div>
                  <dt>Neighbourhood</dt>
                  <dd>{venue.neighbourhood || venue.city || 'Not listed yet'}</dd>
                </div>
              </dl>
              <div className="rd-side-card__trust">
                <ShieldCheck size={16} aria-hidden="true" />
                Verified reviews are tied to a signed visit invite. Community reviews wait for
                moderation.
              </div>
            </section>

            {venue.externalStats.length > 0 && (
              <section className="rd-side-card">
                <h2>Ratings from other sites</h2>
                <p>Listed separately. They are not added to the Travio score.</p>
                <ul className="rd-external-list">
                  {venue.externalStats.map((stat) => (
                    <li key={stat.source}>
                      <span>{sourceLabel(stat.source)}</span>
                      <strong>{stat.rating != null ? stat.rating.toFixed(1) : '—'}</strong>
                      <small>{stat.reviewCount.toLocaleString()} reviews</small>
                      {stat.productUrl && (
                        <a href={stat.productUrl} target="_blank" rel="noreferrer">
                          <ExternalLink size={12} aria-hidden="true" /> View source
                        </a>
                      )}
                    </li>
                  ))}
                </ul>
              </section>
            )}

            <section className="rd-side-card rd-side-card--claim">
              <h2>Manage this listing</h2>
              <p>
                Restaurant staff can ask to update the listing description, hours and contact
                details.
              </p>
              <Link to={isManager ? `/restaurants/${venue.slug}/manage` : `/restaurants/${venue.slug}/claim`}>
                {isManager ? 'Open owner tools' : 'Claim this restaurant'}
              </Link>
            </section>
          </aside>
        </div>
      </main>

      <Footer />
    </div>
  )
}
