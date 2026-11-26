import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
  type MouseEvent,
} from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import {
  ArrowUpRight,
  BadgeCheck,
  Camera,
  Check,
  ChevronRight,
  Coffee,
  ExternalLink,
  Flag,
  MapPin,
  Moon,
  Navigation,
  PenLine,
  Phone,
  Share2,
  ShieldCheck,
  Sparkles,
  Sun,
  ThumbsUp,
  UtensilsCrossed,
  Wine,
  X,
} from 'lucide-react'
import { toast } from 'sonner'
import SEO, { SITE_URL } from '../../components/SEO'
import Footer from '../../components/Footer'
import RestaurantDetailSkeleton from './RestaurantDetailSkeleton'
import GalleryDialog from '../tour-detail/GalleryDialog'
import OptimizedImage from '../../components/shared/OptimizedImage'
import RestaurantCard from '../../components/RestaurantCard'
import StarRating from '../../components/StarRating'
import { useAuthUser } from '../../hooks/useAuthUser'
import { useAuthContext } from '../../context/AuthContext'
import {
  useRestaurantVenue,
  useRestaurantVenueReviews,
  useRestaurantVenues,
  type RestaurantVenueDetail,
  type RestaurantVenueReview,
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
import './RestaurantDetailPage.css'

const REPORT_REASONS = [
  'Not a first-hand visit',
  'Review is about a different restaurant',
  'Offensive or irrelevant content',
  'Conflict of interest',
]

const COMPANION_LABELS: Record<string, string> = {
  BUSINESS: 'Business',
  COUPLES: 'Couples',
  FAMILY: 'Family',
  FRIENDS: 'Friends',
  SOLO: 'Solo',
}

const SECTION_LABELS: Record<string, string> = {
  overview: 'Overview',
  menu: 'Menu',
  hours: 'Hours',
  location: 'Location',
  reviews: 'Reviews',
}

/** Matches the section scroll-margin so a heading becomes active under the sticky nav. */
function sectionTriggerOffset(): number {
  const rootStyle = getComputedStyle(document.documentElement)
  const banner = Number.parseFloat(rootStyle.getPropertyValue('--preview-banner-height')) || 0
  return 140 + banner
}

function sectionTop(id: string): number {
  const element = document.getElementById(id)
  if (!element) return Number.POSITIVE_INFINITY
  return element.getBoundingClientRect().top + window.scrollY
}

/** Section order follows the page as it scrolls, including the stacked mobile layout. */
function sectionsInScrollOrder(ids: string[]): string[] {
  return [...ids].sort((a, b) => sectionTop(a) - sectionTop(b))
}

function activeSectionFor(ids: string[]): string | null {
  if (!ids.length) return null
  const ranked = sectionsInScrollOrder(ids).filter((id) => Number.isFinite(sectionTop(id)))
  if (!ranked.length) return ids[0]

  const documentHeight = document.documentElement.scrollHeight
  if (documentHeight > 0 && window.innerHeight + window.scrollY >= documentHeight - 2) {
    return ranked[ranked.length - 1]
  }

  const trigger = window.scrollY + sectionTriggerOffset()
  let active = ranked[0]
  for (const id of ranked) {
    if (sectionTop(id) > trigger) break
    active = id
  }
  return active
}

function sameOrder(a: string[], b: string[]): boolean {
  return a.length === b.length && a.every((id, index) => id === b[index])
}

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

/**
 * Keyless OpenStreetMap preview centred on the venue. The marker is part of
 * the OSM embed URL, so the pin lands on the stored coordinates rather than a
 * stylised grid. No API key, no guessed geocode: without coordinates we show
 * the address fallback instead.
 */
function mapPreviewUrl(lat: number, lng: number): string {
  const latSpan = 0.0042
  const lngSpan = latSpan * 1.55
  const bbox = [lng - lngSpan, lat - latSpan, lng + lngSpan, lat + latSpan]
    .map((value) => value.toFixed(5))
    .join('%2C')
  return `https://www.openstreetmap.org/export/embed.html?bbox=${bbox}&layer=mapnik&marker=${lat.toFixed(
    5,
  )}%2C${lng.toFixed(5)}`
}

function mealIcon(meal: string) {
  const value = meal.toLowerCase()
  if (value.includes('breakfast') || value.includes('brunch') || value.includes('coffee')) return Coffee
  if (value.includes('lunch') || value.includes('afternoon')) return Sun
  if (value.includes('dinner') || value.includes('evening')) return Moon
  if (value.includes('drink') || value.includes('wine') || value.includes('bar')) return Wine
  return UtensilsCrossed
}

function formatHours(hours: Record<string, unknown> | null): { day: string; value: string }[] {
  if (!hours) return []
  return Object.entries(hours)
    .map(([day, value]) => ({ day: displayLabel(day.replace(/_/g, ' ')), value: formatHourValue(value) }))
    .filter((row) => row.value)
}

function average(values: (number | null)[]): number | null {
  const present = values.filter((value): value is number => typeof value === 'number' && value > 0)
  if (!present.length) return null
  return present.reduce((sum, value) => sum + value, 0) / present.length
}

function RatingBar({ stars, count, total }: { stars: number; count: number; total: number }) {
  const percent = total > 0 ? Math.round((count / total) * 100) : 0
  return (
    <div className="rvd-bar">
      <span className="rvd-bar__label">{stars}</span>
      <span className="rvd-bar__track">
        <span style={{ width: `${percent}%` }} />
      </span>
      <span className="rvd-bar__count">{count}</span>
    </div>
  )
}

function reviewInitial(name: string | null): string {
  return (name?.trim()[0] || 'D').toUpperCase()
}

function ReviewCard({
  review,
  slug,
  user,
  promptSignIn,
  onReport,
  reporting,
  reportState,
}: {
  review: RestaurantVenueReview
  slug: string
  user: unknown
  promptSignIn: (path: string) => void
  onReport: (reviewId: string | null) => void
  reporting: boolean
  reportState: {
    reason: string
    detail: string
    setReason: (value: string) => void
    setDetail: (value: string) => void
    submit: (event: FormEvent<HTMLFormElement>) => void
    pending: boolean
  }
}) {
  return (
    <article className="rvd-review">
      <header className="rvd-review__head">
        <div className="rvd-review__person">
          {review.author.photoURL ? (
            <img
              src={review.author.photoURL}
              alt=""
              aria-hidden="true"
              className="rvd-review__avatar"
              loading="lazy"
              decoding="async"
              width={44}
              height={44}
            />
          ) : (
            <span className="rvd-review__avatar rvd-review__avatar--fallback" aria-hidden="true">
              {reviewInitial(review.author.name)}
            </span>
          )}
          <div className="rvd-review__person-copy">
            <strong>{review.author.name ?? 'Travio diner'}</strong>
            <span className="rvd-review__person-meta">
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
      </header>

      <div className="rvd-review__stars">
        <StarRating
          value={review.rating}
          size={18}
          gap={2}
          filledColor="#3a9a4e"
          emptyColor="#e5e7eb"
          ariaLabel={`${review.rating} out of 5 stars`}
        />
      </div>

      {review.title && <h3>{review.title}</h3>}
      {review.body && <p>{review.body}</p>}

      {review.companions.length > 0 && (
        <div className="rvd-review__trip" aria-label="Who they went with">
          <span className="rvd-review__trip-label">Trip type:</span>
          <strong>
            {review.companions
              .map((companion) => COMPANION_LABELS[companion] ?? displayLabel(companion))
              .join(', ')}
          </strong>
        </div>
      )}

      {review.photos.length > 0 && (
        <div className="rvd-review__photos">
          {review.photos.map((photo) => (
            <OptimizedImage key={photo} src={photo} alt="" width={150} height={110} fit="crop" />
          ))}
        </div>
      )}

      <footer className="rvd-review__foot">
        <span className="rvd-review__helpful">
          <ThumbsUp size={14} aria-hidden="true" />
          Helpful · {review.helpfulCount}
        </span>
        <button
          type="button"
          onClick={() => {
            if (!user) {
              promptSignIn(`/restaurants/${slug}`)
              return
            }
            onReport(reporting ? null : review.id)
          }}
        >
          <Flag size={13} aria-hidden="true" /> Report
        </button>
      </footer>

      {reporting && (
        <form className="rvd-report" onSubmit={(event) => reportState.submit(event)}>
          <label>
            Reason
            <select
              value={reportState.reason}
              onChange={(event) => reportState.setReason(event.target.value)}
            >
              {REPORT_REASONS.map((reason) => (
                <option key={reason}>{reason}</option>
              ))}
            </select>
          </label>
          <label>
            More detail (optional)
            <textarea
              value={reportState.detail}
              onChange={(event) => reportState.setDetail(event.target.value)}
              rows={2}
              maxLength={1000}
            />
          </label>
          <div>
            <button type="submit" disabled={reportState.pending}>
              {reportState.pending ? 'Sending…' : 'Send report'}
            </button>
            <button type="button" onClick={() => onReport(null)}>
              Cancel
            </button>
          </div>
        </form>
      )}
    </article>
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
  const [galleryOpen, setGalleryOpen] = useState(false)
  const [galleryIndex, setGalleryIndex] = useState(0)
  const [aboutOpen, setAboutOpen] = useState(false)
  const [reportingReview, setReportingReview] = useState<string | null>(null)
  const [reportReason, setReportReason] = useState(REPORT_REASONS[0])
  const [reportDetail, setReportDetail] = useState('')
  const [reviewSearch, setReviewSearch] = useState('')
  const [reviewRating, setReviewRating] = useState('all')
  const [reviewSort, setReviewSort] = useState('recent')

  const venueReady = Boolean(venueQuery.data)
  const hasMenu = Boolean(
    venueQuery.data?.menuUrl || (venueQuery.data?.mealTypes?.length ?? 0) > 0,
  )
  const baseSectionIds = useMemo(
    () => [
      'overview',
      ...(hasMenu ? ['menu'] : []),
      'hours',
      'location',
      'reviews',
    ],
    [hasMenu],
  )
  const [sectionIds, setSectionIds] = useState(baseSectionIds)
  const [activeSection, setActiveSection] = useState(baseSectionIds[0])
  const navigationLock = useRef<{ id: string; until: number } | null>(null)

  useEffect(() => {
    let frame = 0
    const reorder = () => {
      frame = 0
      const next = sectionsInScrollOrder(
        baseSectionIds.filter((id) => document.getElementById(id)),
      )
      setSectionIds((current) => (sameOrder(current, next) ? current : next))
    }
    const schedule = () => {
      if (!frame) frame = window.requestAnimationFrame(reorder)
    }

    schedule()
    window.addEventListener('resize', schedule)
    return () => {
      if (frame) window.cancelAnimationFrame(frame)
      window.removeEventListener('resize', schedule)
    }
  }, [baseSectionIds, venueReady])

  useEffect(() => {
    const hash = decodeURIComponent(window.location.hash.slice(1))
    const initialId = sectionIds.includes(hash) ? hash : null

    let frame = 0
    let initialFrame = 0
    const sync = (timeStamp: number) => {
      frame = 0
      const lock = navigationLock.current
      const lockedTarget = lock ? document.getElementById(lock.id) : null
      if (
        lock &&
        lockedTarget &&
        timeStamp < lock.until &&
        lockedTarget.getBoundingClientRect().top > sectionTriggerOffset() - 8
      ) {
        return
      }
      navigationLock.current = null
      setActiveSection(activeSectionFor(sectionIds) ?? sectionIds[0])
    }
    const onScroll = (event: Event) => {
      if (!frame) frame = window.requestAnimationFrame(() => sync(event.timeStamp))
    }

    initialFrame = window.requestAnimationFrame(() => {
      sync(Number.POSITIVE_INFINITY)
      if (initialId) {
        setActiveSection(initialId)
        document.getElementById(initialId)?.scrollIntoView({ behavior: 'auto', block: 'start' })
      }
    })
    window.addEventListener('scroll', onScroll, { passive: true })
    window.addEventListener('resize', onScroll)
    return () => {
      if (frame) window.cancelAnimationFrame(frame)
      if (initialFrame) window.cancelAnimationFrame(initialFrame)
      window.removeEventListener('scroll', onScroll)
      window.removeEventListener('resize', onScroll)
    }
  }, [sectionIds])

  const onSectionClick = (event: MouseEvent<HTMLAnchorElement>, id: string) => {
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0) return
    const target = document.getElementById(id)
    if (!target) return

    event.preventDefault()
    const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
    navigationLock.current = { id, until: event.timeStamp + 4000 }
    target.scrollIntoView({ behavior: reduced ? 'auto' : 'smooth', block: 'start' })
    window.history.replaceState(null, '', `#${id}`)
    setActiveSection(id)
  }

  const venue = venueQuery.data
  // Older API builds do not return the menu fields; treat them as empty until
  // the backend deploy catches up rather than rendering undefined.
  const mealTypes = venue?.mealTypes ?? []
  const nearbyQuery = useRestaurantVenues({ city: venue?.city ?? undefined, sort: 'rating' })
  const images = useMemo(() => (venue ? galleryImages(venue) : []), [venue])
  const reviews = useMemo(
    () => reviewsQuery.data?.pages.flatMap((page) => page.reviews) ?? [],
    [reviewsQuery.data],
  )
  const distribution =
    reviewsQuery.data?.pages[0]?.distribution ?? venue?.distribution ?? null
  const distributionTotal = distribution
    ? Object.values(distribution).reduce((sum, count) => sum + Number(count || 0), 0)
    : 0
  const hours = formatHours(venue?.hours ?? null)
  const isManager = Boolean(claimQuery.data?.membership)

  const filteredReviews = useMemo(() => {
    const needle = reviewSearch.trim().toLowerCase()
    const filtered = reviews.filter((review) => {
      if (reviewRating !== 'all' && review.rating !== Number(reviewRating)) return false
      if (!needle) return true
      return [review.title, review.body, review.author.name]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(needle))
    })
    return [...filtered].sort((a, b) => {
      if (reviewSort === 'highest') return b.rating - a.rating
      if (reviewSort === 'lowest') return a.rating - b.rating
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    })
  }, [reviews, reviewRating, reviewSearch, reviewSort])

  const recentLoved = useMemo(
    () => reviews.filter((review) => review.rating >= 4).slice(0, 3),
    [reviews],
  )

  const nearby = useMemo(() => {
    const rows = nearbyQuery.data?.pages.flatMap((page) => page.venues) ?? []
    return rows.filter((row) => row.id !== venue?.id).slice(0, 4)
  }, [nearbyQuery.data, venue?.id])

  const external = venue?.externalStats[0] ?? null
  const foodAverage = average(reviews.map((review) => review.foodRating))
  const serviceAverage = average(reviews.map((review) => review.serviceRating))
  const atmosphereAverage = average(reviews.map((review) => review.atmosphereRating))
  const valueAverage = average(reviews.map((review) => review.valueRating))

  if (venueQuery.isPending) {
    return <RestaurantDetailSkeleton />
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

  const submitReport = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!user) {
      promptSignIn(`/restaurants/${slug}`)
      return
    }
    if (!reportingReview) return
    try {
      await report.mutateAsync({
        reviewId: reportingReview,
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

  const share = async () => {
    const url = window.location.href
    try {
      if (navigator.share) {
        await navigator.share({ title: venue.name, text: `Dining at ${venue.name}`, url })
        return
      }
      await navigator.clipboard.writeText(url)
      toast.success('Link copied')
    } catch {
      toast.error('We could not share this page.')
    }
  }

  const dismissSubmittedNotice = () => {
    const next = new URLSearchParams(searchParams)
    next.delete('review')
    setSearchParams(next, { replace: true })
  }

  const externalLabel = external ? sourceLabel(external.source) : ''
  const rankLabel = venue.rank
    ? `#${venue.rank.position}${venue.rank.of ? ` of ${venue.rank.of}` : ''} in ${venue.city ?? 'Ghana'}`
    : null
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

      <main className="restaurants-page__main rvd-page">
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
          <div className="rvd-notice" role="status">
            <Check size={17} aria-hidden="true" />
            <span>Your review was sent. It will appear here once our moderators clear it.</span>
            <button type="button" onClick={dismissSubmittedNotice} aria-label="Dismiss message">
              <X size={16} />
            </button>
          </div>
        )}

        <header className="rvd-header">
          <div className="rvd-header__main">
            <div className="rvd-badges">
              {rankLabel && <span className="rvd-badge rvd-badge--rank">{rankLabel}</span>}
              {venue.rank?.position === 1 && (
                <span className="rvd-badge rvd-badge--award">
                  <Sparkles size={13} aria-hidden="true" /> Top-ranked in {venue.city ?? 'the city'}
                </span>
              )}
              {venue.verifiedReviewCount > 0 && (
                <span className="rvd-badge rvd-badge--verified">
                  <BadgeCheck size={13} aria-hidden="true" />
                  {venue.verifiedReviewCount} verified visits
                </span>
              )}
            </div>

            <h1>{venue.name}</h1>

            <div className="rvd-header__meta">
              {venue.rating != null ? (
                <span className="rvd-header__rating">
                  <StarRating value={venue.rating} size={17} />
                  <strong>{venue.rating.toFixed(1)}</strong>
                  <span>{venue.reviewCount} Travio reviews</span>
                </span>
              ) : (
                <span className="rvd-header__rating rvd-header__rating--new">New on Travio</span>
              )}
              {external && (
                <span className="rvd-header__external">
                  {externalLabel} <strong>{external.rating?.toFixed(1)}</strong>
                  <span>· {external.reviewCount.toLocaleString()} reviews</span>
                </span>
              )}
            </div>

            <div className="rvd-header__facts">
              <span>
                <MapPin size={15} aria-hidden="true" />
                {locationText(venue) || 'Location to be confirmed'}
              </span>
              <span>{venue.cuisines.slice(0, 3).map(displayLabel).join(' · ') || 'Restaurant'}</span>
              {venue.priceBand && <span>{priceLabel(venue.priceBand)}</span>}
            </div>
          </div>

          <div className="rvd-header__actions">
            <Link className="rvd-button rvd-button--primary" to={`/restaurants/${venue.slug}/review`}>
              <PenLine size={16} aria-hidden="true" /> Write a review
            </Link>
            <button className="rvd-button rvd-button--quiet" type="button" onClick={() => void share()}>
              <Share2 size={16} aria-hidden="true" /> Share
            </button>
            <a className="rvd-button rvd-button--quiet" href={mapHref(venue)} target="_blank" rel="noreferrer">
              <Navigation size={16} aria-hidden="true" /> Directions
            </a>
          </div>
        </header>

        <section
          className={`rd-gallery${images.length === 1 ? ' rd-gallery--single' : ''}`}
          id="photos"
          aria-label={`Photos of ${venue.name}`}
        >
          {images.length > 0 ? (
            <>
              <button
                type="button"
                className="rd-gallery__main"
                onClick={() => {
                  setGalleryIndex(0)
                  setGalleryOpen(true)
                }}
                aria-label={`View all ${images.length} photos`}
              >
                <OptimizedImage
                  src={images[0]}
                  alt={`${venue.name} photo 1`}
                  width={900}
                  height={560}
                  fit="crop"
                  sizes="(max-width: 900px) 92vw, 64vw"
                  priority
                />
                {images.length > 1 && (
                  <span className="rd-gallery__count" aria-hidden="true">
                    <Camera size={19} strokeWidth={2} />
                    {images.length}
                  </span>
                )}
              </button>
              {images.length > 1 && (
                <div className="rd-gallery__tiles">
                  {images.slice(1, 4).map((image, index) => (
                    <button
                      key={image}
                      type="button"
                      className="rd-gallery__tile"
                      onClick={() => {
                        setGalleryIndex(index + 1)
                        setGalleryOpen(true)
                      }}
                      aria-label={`Open photo ${index + 2} of ${images.length}`}
                    >
                      <OptimizedImage
                        src={image}
                        alt=""
                        width={300}
                        height={220}
                        fit="crop"
                        sizes="(max-width: 900px) 30vw, 204px"
                      />
                      <span className="rd-gallery__tile-label">Photo {index + 2}</span>
                      <span className="rd-gallery__tile-count">
                        {index + 2} / {images.length}
                      </span>
                    </button>
                  ))}
                </div>
              )}
              {images.length === 1 && (
                <div className="rd-gallery__side">
                  <span className="rd-gallery__side-icon">
                    <Camera size={19} aria-hidden="true" />
                  </span>
                  <strong>1 restaurant photo</strong>
                  <p>
                    This listing is still building its photo library. Add a shot from your visit and
                    help the next diner see the room, the plate or the menu.
                  </p>
                  <Link to={`/restaurants/${venue.slug}/review`}>Add a photo with your review</Link>
                </div>
              )}
            </>
          ) : (
            <div className="rd-gallery__empty">Photos will be added when the listing is verified.</div>
          )}
        </section>
        <GalleryDialog
          key={`${galleryOpen ? 'open' : 'closed'}-${galleryIndex}`}
          open={galleryOpen}
          onOpenChange={setGalleryOpen}
          images={images}
          initialIndex={galleryIndex}
        />

        <nav className="rvd-anchor-nav" aria-label="Restaurant sections">
          {sectionIds.map((id) => {
            const isActive = activeSection === id
            return (
              <a
                key={id}
                href={`#${id}`}
                className={isActive ? 'is-active' : undefined}
                aria-current={isActive ? 'location' : undefined}
                onClick={(event) => onSectionClick(event, id)}
              >
                {SECTION_LABELS[id]}
              </a>
            )
          })}
        </nav>

        <div className="rvd-layout">
          <div className="rvd-main-column">
            <section className="rvd-section rvd-at-glance" id="overview">
              <h2>At a glance</h2>
              <p className="rvd-open-status">
                {hours[0]?.value ? `Dinner service · ${hours[0].value}` : 'Hours not added yet'}
              </p>
              <a className="rvd-address" href={mapHref(venue)} target="_blank" rel="noreferrer">
                <MapPin size={16} aria-hidden="true" />
                {venue.addressLine || locationText(venue) || 'Open in Maps'}
              </a>
              <div className="rvd-at-glance__links">
                {venue.website && (
                  <a href={websiteHref(venue.website)} target="_blank" rel="noreferrer">
                    <ExternalLink size={14} aria-hidden="true" /> Website
                  </a>
                )}
                {venue.phone && (
                  <a href={`tel:${venue.phone.replace(/\s/g, '')}`}>
                    <Phone size={14} aria-hidden="true" /> {venue.phone}
                  </a>
                )}
                <Link to={isManager ? `/restaurants/${venue.slug}/manage` : `/restaurants/${venue.slug}/claim`}>
                  Improve this listing
                </Link>
              </div>
            </section>

            <section className="rvd-section">
              <h2>About {venue.name}</h2>
              <div className={`rvd-about${aboutOpen ? ' is-open' : ''}`}>
                <p>
                  {venue.description ||
                    `A neighbourhood restaurant in ${venue.city ?? 'Ghana'}. We are still collecting the full story from the business.`}
                </p>
              </div>
              {venue.description && venue.description.length > 180 && (
                <button
                  className="rvd-text-button"
                  type="button"
                  onClick={() => setAboutOpen((open) => !open)}
                >
                  {aboutOpen ? 'Read less' : 'Read more'}
                  <ChevronRight size={14} className={aboutOpen ? 'is-open' : ''} aria-hidden="true" />
                </button>
              )}

              <div className="rvd-feature-grid">
                {venue.cuisines.length > 0 && (
                  <div className="rvd-feature-group">
                    <h3>Cuisines</h3>
                    <div className="rvd-chips">
                      {venue.cuisines.map((value) => (
                        <span key={value}>{displayLabel(value)}</span>
                      ))}
                    </div>
                  </div>
                )}
                {venue.dietary.length > 0 && (
                  <div className="rvd-feature-group">
                    <h3>Dietary options</h3>
                    <div className="rvd-chips">
                      {venue.dietary.map((value) => (
                        <span key={value}>{displayLabel(value)}</span>
                      ))}
                    </div>
                  </div>
                )}
                {venue.amenities.length > 0 && (
                  <div className="rvd-feature-group">
                    <h3>Features</h3>
                    <div className="rvd-chips">
                      {venue.amenities.map((value) => (
                        <span key={value}>{displayLabel(value)}</span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </section>

            {(venue.menuUrl || mealTypes.length > 0) && (
              <section className="rvd-section rvd-menu" id="menu" aria-labelledby="menu-title">
                <div className="rvd-section__heading rvd-section__heading--row">
                  <div>
                    <span className="rvd-eyebrow">From the kitchen</span>
                    <h2 id="menu-title">Menu &amp; meal service</h2>
                    <p>
                      What the restaurant publishes about its food service. Dishes and prices stay
                      with the restaurant, never with Travio.
                    </p>
                  </div>
                  {venue.priceBand && (
                    <span className="rvd-menu__price">{priceLabel(venue.priceBand)}</span>
                  )}
                </div>

                <div className="rvd-menu__card">
                  <div className="rvd-menu__service">
                    <span className="rvd-menu__label">Meals served</span>
                    {mealTypes.length > 0 ? (
                      <ul>
                        {mealTypes.map((meal) => {
                          const Icon = mealIcon(meal)
                          return (
                            <li key={meal}>
                              <span className="rvd-menu__icon">
                                <Icon size={16} aria-hidden="true" />
                              </span>
                              {displayLabel(meal)}
                            </li>
                          )
                        })}
                      </ul>
                    ) : (
                      <p>Meal times have not been added yet.</p>
                    )}
                  </div>

                  <div className="rvd-menu__action">
                    {venue.menuUrl ? (
                      <>
                        <span className="rvd-menu__label">The menu</span>
                        <strong>See what is on before you go</strong>
                        <p>Opens the restaurant&rsquo;s own menu in a new tab.</p>
                        <a
                          className="rvd-menu__button"
                          href={websiteHref(venue.menuUrl)}
                          target="_blank"
                          rel="noreferrer"
                        >
                          View the menu <ArrowUpRight size={15} aria-hidden="true" />
                        </a>
                      </>
                    ) : (
                      <>
                        <span className="rvd-menu__label">The menu</span>
                        <strong>Not shared yet</strong>
                        <p>Claim this listing to publish a menu link and meal services.</p>
                        <Link
                          className="rvd-menu__button rvd-menu__button--quiet"
                          to={isManager ? `/restaurants/${venue.slug}/manage` : `/restaurants/${venue.slug}/claim`}
                        >
                          {isManager ? 'Add the menu' : 'Claim this restaurant'}
                        </Link>
                      </>
                    )}
                  </div>
                </div>
              </section>
            )}

            <section className="rvd-section rvd-love" aria-labelledby="why-love">
              <div className="rvd-section__heading">
                <h2 id="why-love">Why diners love this</h2>
              </div>

              {recentLoved.length > 0 ? (
                <div className="rvd-love__rail">
                  {recentLoved.map((review) => (
                    <article key={review.id} className="rvd-love__card">
                      <StarRating value={review.rating} size={14} />
                      <h3>{review.title || 'A recent visit'}</h3>
                      <p>{review.body}</p>
                      <span>{review.author.name ?? 'Travio diner'}</span>
                    </article>
                  ))}
                </div>
              ) : external ? (
                <div className="rvd-love__external">
                  <div className="rvd-love__score">
                    <strong>{external.rating?.toFixed(1) ?? '—'}</strong>
                    <StarRating value={external.rating ?? 0} size={18} />
                    <span>{external.reviewCount.toLocaleString()} reviews on {externalLabel}</span>
                  </div>
                  <div>
                    <h3>A local favourite, according to {externalLabel}</h3>
                    <p>
                      We keep outside scores separate from Travio ratings. Read the full review history on{' '}
                      {externalLabel} while our own diner reviews build.
                    </p>
                    {external.productUrl && (
                      <a href={external.productUrl} target="_blank" rel="noreferrer">
                        Read on {externalLabel} <ExternalLink size={13} aria-hidden="true" />
                      </a>
                    )}
                  </div>
                </div>
              ) : (
                <div className="rvd-love__empty">
                  <Sparkles size={20} aria-hidden="true" />
                  <div>
                    <h3>Be the first to put this place on the map</h3>
                    <p>Share a visit and help the next diner choose well.</p>
                  </div>
                  <Link to={`/restaurants/${venue.slug}/review`}>Write a review</Link>
                </div>
              )}
            </section>

            <section className="rvd-section" id="reviews">
              <div className="rvd-section__heading rvd-section__heading--row">
                <div>
                  <h2>Travio reviews</h2>
                  <p>Only Travio diner reviews shape this rating. Outside scores stay separate.</p>
                </div>
                <Link className="rvd-button rvd-button--small" to={`/restaurants/${venue.slug}/review`}>
                  <PenLine size={15} aria-hidden="true" /> Write a review
                </Link>
              </div>

              <div className="rvd-review-summary">
                <div className="rvd-review-summary__score">
                  <strong>{venue.rating != null ? venue.rating.toFixed(1) : '—'}</strong>
                  <StarRating value={venue.rating ?? 0} size={18} />
                  <span>
                    {venue.reviewCount} {venue.reviewCount === 1 ? 'review' : 'reviews'}
                  </span>
                </div>
                <div className="rvd-review-summary__bars">
                  {[5, 4, 3, 2, 1].map((stars) => (
                    <RatingBar
                      key={stars}
                      stars={stars}
                      count={Number(distribution?.[String(stars)] ?? 0)}
                      total={distributionTotal}
                    />
                  ))}
                </div>
                <div className="rvd-review-summary__subs">
                  {[
                    ['Food', foodAverage],
                    ['Service', serviceAverage],
                    ['Atmosphere', atmosphereAverage],
                    ['Value', valueAverage],
                  ].map(([label, value]) => (
                    <div key={label as string}>
                      <span>{label as string}</span>
                      <strong>{typeof value === 'number' ? value.toFixed(1) : '—'}</strong>
                    </div>
                  ))}
                </div>
              </div>

              <div className="rvd-review-tools">
                <label className="rvd-search">
                  <span className="sr-only">Search reviews</span>
                  <input
                    type="search"
                    placeholder="Search reviews"
                    value={reviewSearch}
                    onChange={(event) => setReviewSearch(event.target.value)}
                  />
                </label>
                <label>
                  <span className="sr-only">Filter by rating</span>
                  <select value={reviewRating} onChange={(event) => setReviewRating(event.target.value)}>
                    <option value="all">All ratings</option>
                    <option value="5">5 stars</option>
                    <option value="4">4 stars</option>
                    <option value="3">3 stars</option>
                    <option value="2">2 stars</option>
                    <option value="1">1 star</option>
                  </select>
                </label>
                <label>
                  <span className="sr-only">Sort reviews</span>
                  <select value={reviewSort} onChange={(event) => setReviewSort(event.target.value)}>
                    <option value="recent">Most recent</option>
                    <option value="highest">Highest rated</option>
                    <option value="lowest">Lowest rated</option>
                  </select>
                </label>
              </div>

              {reviewsQuery.isPending && <p className="rvd-muted">Loading reviews…</p>}
              {reviewsQuery.isError && (
                <div className="rvd-inline-state">
                  <p>We could not load reviews right now.</p>
                  <button type="button" onClick={() => void reviewsQuery.refetch()}>
                    Try again
                  </button>
                </div>
              )}

              {!reviewsQuery.isPending && !reviewsQuery.isError && reviews.length === 0 && (
                <div className="rvd-empty-reviews">
                  <div>
                    <StarRating value={0} size={18} />
                    <h3>No Travio reviews yet</h3>
                    <p>This table is waiting for its first diner story.</p>
                  </div>
                  <Link to={`/restaurants/${venue.slug}/review`}>Be the first to review</Link>
                </div>
              )}

              {!reviewsQuery.isPending && reviews.length > 0 && filteredReviews.length === 0 && (
                <p className="rvd-muted">No reviews match that search.</p>
              )}

              <div className="rvd-reviews">
                {filteredReviews.map((review) => (
                  <ReviewCard
                    key={review.id}
                    review={review}
                    slug={slug}
                    user={user}
                    promptSignIn={promptSignIn}
                    onReport={setReportingReview}
                    reporting={reportingReview === review.id}
                    reportState={{
                      reason: reportReason,
                      detail: reportDetail,
                      setReason: setReportReason,
                      setDetail: setReportDetail,
                      submit: submitReport,
                      pending: report.isPending,
                    }}
                  />
                ))}
              </div>

              {reviewsQuery.hasNextPage && (
                <button
                  className="rvd-load-more"
                  type="button"
                  disabled={reviewsQuery.isFetchingNextPage}
                  onClick={() => void reviewsQuery.fetchNextPage()}
                >
                  {reviewsQuery.isFetchingNextPage ? 'Loading…' : 'Show more reviews'}
                </button>
              )}
            </section>

            <section className="rvd-section" id="location">
              <div className="rvd-section__heading">
                <h2>Location</h2>
              </div>
              <div className="rvd-location">
                <div className="rvd-map">
                  {venue.latitude != null && venue.longitude != null ? (
                    <iframe
                      title={`Map showing ${venue.name}`}
                      src={mapPreviewUrl(venue.latitude, venue.longitude)}
                      loading="lazy"
                      referrerPolicy="no-referrer-when-downgrade"
                    />
                  ) : (
                    <div className="rvd-map__empty">
                      <MapPin size={24} aria-hidden="true" />
                      <strong>Map pin coming soon</strong>
                      <span>{venue.addressLine || locationText(venue) || 'Address to be confirmed'}</span>
                    </div>
                  )}
                </div>
                <div className="rvd-location__copy">
                  <span className="rvd-eyebrow">Find the table</span>
                  <strong>{venue.addressLine || 'Street address to be confirmed'}</strong>
                  <p>{[venue.neighbourhood, venue.city, venue.region, venue.country].filter(Boolean).join(', ')}</p>
                  <div className="rvd-location__actions">
                    <a className="rvd-button rvd-button--small" href={mapHref(venue)} target="_blank" rel="noreferrer">
                      <Navigation size={14} aria-hidden="true" /> Open in Google Maps
                    </a>
                    <Link
                      className="rvd-text-button"
                      to={isManager ? `/restaurants/${venue.slug}/manage` : `/restaurants/${venue.slug}/claim`}
                    >
                      {isManager ? 'Update this pin' : 'Correct this location'}
                    </Link>
                  </div>
                </div>
              </div>
            </section>

            <section className="rvd-owner-band" id="owners">
              <div>
                <span className="rvd-eyebrow">For the people behind the pass</span>
                <h2>{isManager ? 'You manage this restaurant' : 'Is this your restaurant?'}</h2>
                <p>
                  {isManager
                    ? 'Update the description, hours and contact details diners see.'
                    : 'Claim the listing to add your story, photos and the details that make this place yours.'}
                </p>
              </div>
              <Link className="rvd-button rvd-button--primary" to={isManager ? `/restaurants/${venue.slug}/manage` : `/restaurants/${venue.slug}/claim`}>
                {isManager ? 'Open owner tools' : 'Claim this restaurant'}
              </Link>
            </section>

            {nearby.length > 0 && (
              <section className="rvd-nearby" aria-labelledby="nearby-title">
                <div className="rvd-section__heading rvd-section__heading--row">
                  <div>
                    <h2 id="nearby-title">More restaurants nearby</h2>
                  </div>
                  <Link className="rvd-text-button" to={`/restaurants?city=${encodeURIComponent(venue.city ?? '')}`}>
                    See all <ChevronRight size={14} aria-hidden="true" />
                  </Link>
                </div>
                <div className="rvd-nearby__rail">
                  {nearby.map((row) => (
                    <RestaurantCard key={row.id} venue={row} />
                  ))}
                </div>
              </section>
            )}
          </div>

          <aside className="rvd-sidebar">
            <section className="rvd-side-card rvd-side-card--cta">
              <h2>Share this restaurant</h2>
              <p>Been here? Your visit helps the next diner choose well.</p>
              <Link className="rvd-side-button" to={`/restaurants/${venue.slug}/review`}>
                <PenLine size={15} aria-hidden="true" /> Write a review
              </Link>
            </section>

            <section className="rvd-side-card" id="hours">
              <div className="rvd-side-card__head">
                <h2>Hours</h2>
                <Link to={isManager ? `/restaurants/${venue.slug}/manage` : `/restaurants/${venue.slug}/claim`}>
                  Suggest an edit
                </Link>
              </div>
              {hours.length ? (
                <dl className="rvd-hours">
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
            </section>

            {venue.externalStats.length > 0 && (
              <section className="rvd-side-card">
                <h2>Ratings from other sites</h2>
                <p>Listed separately. They are not added to the Travio score.</p>
                <ul className="rvd-external-list">
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

            <section className="rvd-side-card rvd-side-card--trust">
              <ShieldCheck size={18} aria-hidden="true" />
              <p>
                Verified reviews are tied to a signed visit invite. Community reviews wait for
                moderation before they affect this page.
              </p>
            </section>
          </aside>
        </div>
      </main>

      <Footer />
    </div>
  )
}
