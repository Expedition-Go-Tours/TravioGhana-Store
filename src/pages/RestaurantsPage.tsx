import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
  type ReactNode,
} from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { useReducedMotion } from 'framer-motion'
import {
  ChevronLeft,
  ChevronRight,
  MapPin,
  Search,
  SlidersHorizontal,
  UtensilsCrossed,
} from 'lucide-react'
import SEO from '../components/SEO'
import Footer from '../components/Footer'
import Hero from '../components/Hero'
import SectionHeading from '../components/SectionHeading'
import StarRating from '../components/StarRating'
import VerticalSwitch from '../components/VerticalSwitch'
import RestaurantCard from '../components/RestaurantCard'
import {
  useRestaurantVenues,
  type RestaurantSort,
  type RestaurantVenue,
  type RestaurantVenueFilters,
} from '../hooks/useRestaurantVenues'
import {
  isRestaurantHomepageSection,
  useLikelyToBookOutRestaurants,
  useRecommendedRestaurants,
  useRestaurantSectionIds,
  useSpecialOfferRestaurants,
} from '../hooks/useRestaurantHomepage'
import { trackRestaurantSearch } from '../lib/analytics'
import { transformImage } from '../lib/image'
import {
  useRecentRestaurantReviews,
  type RecentRestaurantReview,
} from '../hooks/useRecentRestaurantReviews'
import useMediaQuery from '../hooks/useMediaQuery'
import useRafCallback from '../hooks/useRafCallback'
import { useCuisinePhotos, type CuisineCardInfo } from '../hooks/useCuisinePhotos'
import './RestaurantsPage.css'

const CITIES = ['Accra', 'Kumasi', 'Cape Coast', 'Takoradi', 'Tamale', 'Elmina']
const DIETARY = ['vegetarian', 'vegan', 'gluten-free', 'halal']

type Cuisine = {
  label: string
  query: RestaurantVenueFilters
  href: string
}

const CUISINES: Cuisine[] = [
  { label: 'Ghanaian', query: { cuisine: 'ghanaian' }, href: '/restaurants?cuisine=ghanaian' },
  { label: 'Nigerian', query: { cuisine: 'nigerian' }, href: '/restaurants?cuisine=nigerian' },
  { label: 'Chinese', query: { cuisine: 'chinese' }, href: '/restaurants?cuisine=chinese' },
  { label: 'Indian', query: { cuisine: 'indian' }, href: '/restaurants?cuisine=indian' },
  { label: 'Italian', query: { cuisine: 'italian' }, href: '/restaurants?cuisine=italian' },
  { label: 'Seafood', query: { cuisine: 'seafood' }, href: '/restaurants?cuisine=seafood' },
  {
    label: 'Vegetarian',
    // The catalogue stores vegetarian as a dietary attribute, not a cuisine.
    query: { dietary: ['vegetarian'] },
    href: '/restaurants?dietary=vegetarian',
  },
]

const CUISINE_PHOTO_QUERIES = CUISINES.map(({ label, query }) => ({ label, query }))

const SORTS: { value: RestaurantSort; label: string }[] = [
  { value: 'rating', label: 'Top rated' },
  { value: 'reviews', label: 'Most reviewed' },
  { value: 'demand', label: 'In demand' },
  { value: 'newest', label: 'Newest' },
]

const PRICE_BANDS = [
  { value: '1', label: 'Budget' },
  { value: '2', label: 'Mid-range' },
  { value: '3', label: 'Upscale' },
  { value: '4', label: 'Fine dining' },
]

const MIN_RATINGS = [
  { value: '4.5', label: '4.5 and up' },
  { value: '4', label: '4 and up' },
  { value: '3.5', label: '3.5 and up' },
]

const MIN_REVIEWS = [
  { value: '100', label: '100 or more' },
  { value: '50', label: '50 or more' },
  { value: '10', label: '10 or more' },
]

const REVIEW_AUTO_SCROLL_INTERVAL = 5000
/** Copies of the review rail used for the endless swipe (previous/current/next). */
const REVIEW_LOOP_COPIES = 3

function optionalNumber(value: string | null): number | undefined {
  if (!value) return undefined
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : undefined
}

function parseDietary(value: string | null): string[] | undefined {
  if (!value) return undefined
  const values = value
    .split(',')
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean)
  return values.length ? values : undefined
}

function parseSort(value: string | null): RestaurantSort | undefined {
  return SORTS.some((option) => option.value === value) ? (value as RestaurantSort) : undefined
}

function buildFilters(params: URLSearchParams): RestaurantVenueFilters {
  const lat = optionalNumber(params.get('lat'))
  const lng = optionalNumber(params.get('lng'))

  return {
    q: params.get('q') || undefined,
    city: params.get('city') || undefined,
    // Venue cuisines are stored lowercase; the labels stay title-cased for
    // display only. Normalise here so the category tiles and filter radio
    // buttons both reach the same API filter.
    cuisine: params.get('cuisine')?.trim().toLowerCase() || undefined,
    dietary: parseDietary(params.get('dietary')),
    priceBand: optionalNumber(params.get('priceBand')),
    minRating: optionalNumber(params.get('minRating')),
    minReviews: optionalNumber(params.get('minReviews')),
    featured: params.get('featured') === 'true' || undefined,
    highDemand: params.get('highDemand') === 'true' || undefined,
    hasOffer: params.get('hasOffer') === 'true' || undefined,
    lat: lat ?? undefined,
    lng: lng ?? undefined,
    radiusKm:
      (lat != null && lng != null ? optionalNumber(params.get('radiusKm')) ?? 10 : undefined) ||
      undefined,
    place: params.get('place') || undefined,
    sort: parseSort(params.get('sort')),
  }
}

function displayLabel(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1)
}

type VenueQuery = ReturnType<typeof useRestaurantVenues>
type RankedVenueQuery = ReturnType<typeof useRecommendedRestaurants>
type RailQuery = VenueQuery | RankedVenueQuery

function railVenues(query: RailQuery): RestaurantVenue[] {
  const data = query.data
  if (!data) return []
  return Array.isArray(data) ? data : data.pages.flatMap((page) => page.venues)
}

function RestaurantRail({
  title,
  description,
  query,
  section,
  to,
  action,
}: {
  title: string
  description: string
  query: RailQuery
  section: string
  to: string
  action?: ReactNode
}) {
  const scrollRef = useRef<HTMLDivElement>(null)
  const [canScrollLeft, setCanScrollLeft] = useState(false)
  const [canScrollRight, setCanScrollRight] = useState(true)
  const reduceMotion = useReducedMotion()
  const venues = railVenues(query)
  const showRail = !query.isPending && !query.isError && venues.length > 0

  const measureStep = useCallback(() => {
    const el = scrollRef.current
    const first = el?.querySelector<HTMLElement>('.rh-home-card-wrap')
    if (!el || !first) return 0
    const gap = parseFloat(getComputedStyle(el).columnGap || '0') || 0
    return first.getBoundingClientRect().width + gap
  }, [])

  const updateArrows = useCallback(() => {
    const el = scrollRef.current
    if (!el) return
    const maxScroll = el.scrollWidth - el.clientWidth
    setCanScrollLeft(el.scrollLeft > 2)
    setCanScrollRight(el.scrollLeft < maxScroll - 2)
  }, [])

  useEffect(() => {
    const el = scrollRef.current
    if (!el) return
    updateArrows()
    el.addEventListener('scroll', updateArrows, { passive: true })
    window.addEventListener('resize', updateArrows)
    return () => {
      el.removeEventListener('scroll', updateArrows)
      window.removeEventListener('resize', updateArrows)
    }
  }, [showRail, updateArrows])

  const scroll = (direction: 'left' | 'right') => {
    const el = scrollRef.current
    if (!el) return
    const step = measureStep() * 3 || el.clientWidth * 0.8
    el.scrollBy({ left: direction === 'left' ? -step : step, behavior: reduceMotion ? 'auto' : 'smooth' })
  }

  return (
    <section className="rh-home-section">
      <div className="rh-section-head">
        <div>
          <h2>{title}</h2>
          <p>{description}</p>
        </div>
        <div className="rh-section-head__actions">
          {action}
          <div className="rh-rail-arrows">
            <button
              type="button"
              className={`rh-rail-arrow${!canScrollLeft ? ' muted' : ''}`}
              onClick={() => scroll('left')}
              aria-label={`Scroll ${title} left`}
              disabled={!canScrollLeft}
            >
              <ChevronLeft size={18} aria-hidden="true" />
            </button>
            <button
              type="button"
              className={`rh-rail-arrow${!canScrollRight ? ' muted' : ''}`}
              onClick={() => scroll('right')}
              aria-label={`Scroll ${title} right`}
              disabled={!canScrollRight}
            >
              <ChevronRight size={18} aria-hidden="true" />
            </button>
          </div>
          <Link to={to}>See all</Link>
        </div>
      </div>

      {query.isPending && (
        <div className="rh-home-rail" aria-label={`Loading ${title}`}>
          {Array.from({ length: 5 }, (_, index) => (
            <div key={index} className="rh-home-card-wrap">
              <div className="restaurant-skeleton" />
            </div>
          ))}
        </div>
      )}

      {query.isError && (
        <div className="rh-home-rail-message">
          <p>We could not load these restaurants right now.</p>
          <button type="button" onClick={() => void query.refetch()}>
            Try again
          </button>
        </div>
      )}

      {!query.isPending && !query.isError && venues.length === 0 && (
        <div className="rh-home-rail-message">
          <p>No restaurants here yet. New places are added as we verify them.</p>
          <Link to={to}>Browse all restaurants</Link>
        </div>
      )}

      {showRail && (
        <div className="rh-rail-clip">
          <div className="rh-home-rail" ref={scrollRef} aria-label={title}>
            {venues.map((venue, index) => (
              <div key={venue.id} className="rh-home-card-wrap">
                <RestaurantCard
                  venue={venue}
                  section={section}
                  position={index}
                />
              </div>
            ))}
          </div>
        </div>
      )}
    </section>
  )
}

function formatReviewDate(value: string): string {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  return new Intl.DateTimeFormat('en-GB', { month: 'short', year: 'numeric' }).format(date)
}

function DinerReviewCard({
  review,
  decorative = false,
}: {
  review: RecentRestaurantReview
  decorative?: boolean
}) {
  const [showModal, setShowModal] = useState(false)
  const textRef = useRef<HTMLParagraphElement>(null)
  const [isTruncated, setIsTruncated] = useState(false)
  const author = review.author.name?.trim() || 'Travio diner'
  const formattedDate = formatReviewDate(review.createdAt)
  const venuePath = `/restaurants/${review.venueSlug}`

  useLayoutEffect(() => {
    const el = textRef.current
    if (!el) return
    const check = () => setIsTruncated(el.scrollHeight > el.clientHeight + 1)
    check()
    if (typeof ResizeObserver === 'undefined') return
    const observer = new ResizeObserver(check)
    observer.observe(el)
    return () => observer.disconnect()
  }, [review.body])

  const stars = (size: number) => (
    <StarRating
      value={review.rating}
      size={size}
      gap={1}
      filledColor="#16a34a"
      emptyColor="#e5e7eb"
    />
  )

  const reviewer = (
    <div className="rh-diner-review-card__reviewer">
      <span className="rh-diner-review-card__reviewer-name">{author}</span>
      {formattedDate && <span className="rh-diner-review-card__date">, {formattedDate}</span>}
      {review.verified && <span className="rh-diner-review-card__verified">Verified visit</span>}
    </div>
  )

  return (
    <>
      <article className="rh-diner-review-card" aria-hidden={decorative || undefined}>
        <div className="rh-diner-review-card__body">
          <div className="rh-diner-review-card__head">
            {review.venueCoverPhoto ? (
              <img
                src={review.venueCoverPhoto}
                alt=""
                aria-hidden="true"
                className="rh-diner-review-card__thumb"
                loading="lazy"
                decoding="async"
                width={56}
                height={56}
              />
            ) : (
              <span
                className="rh-diner-review-card__thumb rh-diner-review-card__thumb--placeholder"
                aria-hidden="true"
              >
                <UtensilsCrossed size={22} strokeWidth={1.8} />
              </span>
            )}
            <span className="rh-diner-review-card__venue-title">{review.venueName}</span>
            {review.venueCity && (
              <span className="rh-diner-review-card__venue-city">{review.venueCity}</span>
            )}
          </div>

          <div className="rh-diner-review-card__stars">{stars(18)}</div>
          {reviewer}

          {review.title && <h3 className="rh-diner-review-card__title">{review.title}</h3>}
          <p ref={textRef} className="rh-diner-review-card__text">
            {review.body}
          </p>
          {isTruncated && (
            <button
              type="button"
              onClick={() => setShowModal(true)}
              className="rh-diner-review-card__read-more"
              tabIndex={decorative ? -1 : undefined}
            >
              Read more
            </button>
          )}

          <div className="rh-diner-review-card__footer">
            <Link
              to={`${venuePath}#reviews`}
              className="rh-diner-review-card__cta"
              tabIndex={decorative ? -1 : undefined}
            >
              View Restaurant
            </Link>
          </div>
        </div>
      </article>

      {showModal && (
        <div className="rh-diner-review-modal-overlay" onClick={() => setShowModal(false)}>
          <div
            className="rh-diner-review-modal"
            role="dialog"
            aria-modal="true"
            aria-label={`Review of ${review.venueName}`}
            onClick={(event) => event.stopPropagation()}
          >
            <button
              type="button"
              className="rh-diner-review-modal__close"
              aria-label="Close review"
              onClick={() => setShowModal(false)}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>

            <div className="rh-diner-review-modal__header">
              <span className="rh-diner-review-modal__venue-title">{review.venueName}</span>
              <div className="rh-diner-review-modal__stars">{stars(20)}</div>
              {reviewer}
            </div>

            {review.title && <h3 className="rh-diner-review-modal__title">{review.title}</h3>}
            <p className="rh-diner-review-modal__text">{review.body}</p>

            <div className="rh-diner-review-modal__footer">
              <Link to={`${venuePath}#reviews`} className="rh-diner-review-card__cta">
                View Restaurant
              </Link>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

function cuisineCountLabel(info: CuisineCardInfo): string {
  const overflow = info.hasMore && info.count >= 50 ? '+' : ''
  const noun = info.count === 1 && !overflow ? 'place' : 'places'
  return `${info.count}${overflow} ${noun}`
}

function CuisineSection({ cards }: { cards?: Record<string, CuisineCardInfo> }) {
  const scrollRef = useRef<HTMLDivElement>(null)
  const [canScrollLeft, setCanScrollLeft] = useState(false)
  const [canScrollRight, setCanScrollRight] = useState(true)
  const reduceMotion = useReducedMotion()

  /** One card + the rail gap, measured from the DOM so it follows the CSS. */
  const measureStep = useCallback(() => {
    const el = scrollRef.current
    const first = el?.querySelector<HTMLElement>('.rh-cuisine-card-wrap')
    if (!el || !first) return 0
    const gap = parseFloat(getComputedStyle(el).columnGap || '0') || 0
    return first.getBoundingClientRect().width + gap
  }, [])

  const updateArrows = useCallback(() => {
    const el = scrollRef.current
    if (!el) return
    const maxScroll = el.scrollWidth - el.clientWidth
    setCanScrollLeft(el.scrollLeft > 2)
    setCanScrollRight(el.scrollLeft < maxScroll - 2)
  }, [])

  useEffect(() => {
    const el = scrollRef.current
    if (!el) return
    updateArrows()
    el.addEventListener('scroll', updateArrows, { passive: true })
    window.addEventListener('resize', updateArrows)
    return () => {
      el.removeEventListener('scroll', updateArrows)
      window.removeEventListener('resize', updateArrows)
    }
  }, [updateArrows])

  const scroll = (direction: 'left' | 'right') => {
    const el = scrollRef.current
    if (!el) return
    const step = measureStep() * 3 || el.clientWidth * 0.8
    el.scrollBy({
      left: direction === 'left' ? -step : step,
      behavior: reduceMotion ? 'auto' : 'smooth',
    })
  }

  return (
    <section className="rh-home-section rh-cuisine-section">
      <div className="rh-section-head">
        <div>
          <span className="rh-cuisine-kicker">Explore by cuisine</span>
          <h2>What are you in the mood for?</h2>
          <p>Choose a cuisine and we’ll show you the places serving it.</p>
        </div>
        <div className="rh-cuisine-arrows">
          <button
            type="button"
            className={`rh-cuisine-arrow${!canScrollLeft ? ' muted' : ''}`}
            onClick={() => scroll('left')}
            aria-label="Scroll cuisine cards left"
            disabled={!canScrollLeft}
          >
            <ChevronLeft size={18} aria-hidden="true" />
          </button>
          <button
            type="button"
            className={`rh-cuisine-arrow${!canScrollRight ? ' muted' : ''}`}
            onClick={() => scroll('right')}
            aria-label="Scroll cuisine cards right"
            disabled={!canScrollRight}
          >
            <ChevronRight size={18} aria-hidden="true" />
          </button>
        </div>
      </div>

      <div className="rh-cuisine-clip">
        <div className="rh-cuisine-rail" ref={scrollRef}>
          {CUISINES.map(({ label, href }) => {
            const info = cards?.[label]
            const photo = info?.photo
            const image = photo
              ? transformImage(photo, { width: 600, quality: 'auto:good', format: 'auto' }) ?? photo
              : null

            return (
              <div className="rh-cuisine-card-wrap" key={label}>
                <Link
                  className="rh-cuisine-card"
                  to={href}
                  aria-label={`See ${label} restaurants in Ghana`}
                >
                  {image ? (
                    <img
                      className="rh-cuisine-card__image"
                      src={image}
                      alt=""
                      width={590}
                      height={440}
                      loading="lazy"
                      decoding="async"
                    />
                  ) : (
                    <span className="rh-cuisine-card__placeholder" aria-hidden="true" />
                  )}
                  <span className="rh-cuisine-card__gradient" aria-hidden="true" />
                  <span className="rh-cuisine-card__top" aria-hidden="true">
                    <span className="rh-cuisine-card__label">{label}</span>
                    {info && <span className="rh-cuisine-card__count">{cuisineCountLabel(info)}</span>}
                  </span>
                  <span className="rh-cuisine-card__footer">
                    <span className="rh-cuisine-card__name">{label}</span>
                    <span className="rh-cuisine-card__arrow">
                      <ChevronRight size={22} aria-hidden="true" />
                    </span>
                  </span>
                </Link>
              </div>
            )
          })}
        </div>
      </div>
    </section>
  )
}

function DinerReviewsRail() {
  const scrollRef = useRef<HTMLDivElement>(null)
  const sectionRef = useRef<HTMLElement>(null)
  const [canScrollLeft, setCanScrollLeft] = useState(false)
  const [canScrollRight, setCanScrollRight] = useState(true)
  const [sectionVisible, setSectionVisible] = useState(false)
  const [pageVisible, setPageVisible] = useState(() =>
    typeof document === 'undefined' ? true : document.visibilityState !== 'hidden',
  )
  // Touch users swipe the rail themselves; auto-advancing fights their scroll.
  const isMobile = useMediaQuery('(max-width: 1023px)')
  const reduceMotion = useReducedMotion()
  const isHovering = useRef(false)
  const autoScrollTimer = useRef<ReturnType<typeof setInterval> | null>(null)

  const query = useRecentRestaurantReviews()
  const reviews = useMemo(
    () => query.data?.pages.flatMap((page) => page.reviews) ?? [],
    [query.data],
  )
  const stats = query.data?.pages[0]?.stats ?? null
  const looping = reviews.length > 1

  /** One card + the rail gap, measured from the DOM so it follows the CSS. */
  const measureStep = useCallback(() => {
    const el = scrollRef.current
    if (!el) return 0
    const first = el.querySelector<HTMLElement>('.rh-diner-reviews-card-wrap')
    if (!first) return 0
    const gap = parseFloat(getComputedStyle(el).columnGap || '0') || 0
    return first.getBoundingClientRect().width + gap
  }, [])

  const updateArrows = useCallback(() => {
    const el = scrollRef.current
    if (!el) return

    if (looping) {
      const setWidth = measureStep() * reviews.length
      if (setWidth > 0) {
        if (el.scrollLeft <= 1) el.scrollLeft += setWidth
        else if (el.scrollLeft >= setWidth * 2) el.scrollLeft -= setWidth
      }
      setCanScrollLeft(true)
      setCanScrollRight(true)
      return
    }

    const maxScroll = el.scrollWidth - el.clientWidth
    setCanScrollLeft(el.scrollLeft > 5)
    setCanScrollRight(el.scrollLeft < maxScroll - 5)
  }, [looping, measureStep, reviews.length])
  const updateArrowsRaf = useRafCallback(updateArrows)

  const scrollTo = useCallback((target: number) => {
    const el = scrollRef.current
    if (!el) return
    if (looping) {
      el.scrollTo({ left: target, behavior: 'smooth' })
      return
    }
    const maxScroll = el.scrollWidth - el.clientWidth
    el.scrollTo({ left: Math.min(target, maxScroll), behavior: 'smooth' })
  }, [looping])

  /** Advance by a full view so the arrows never leave a clipped card behind. */
  const pageStep = () => {
    const el = scrollRef.current
    const step = measureStep()
    if (!el || !step) return 0
    return step * Math.max(1, Math.round(el.clientWidth / step))
  }

  const scroll = (direction: 'left' | 'right') => {
    const el = scrollRef.current
    if (!el) return
    const delta = pageStep()
    const current = el.scrollLeft
    scrollTo(direction === 'left' ? current - delta : current + delta)
  }

  const loopedCards = useMemo(() => {
    if (!looping) {
      return reviews.map((review) => ({ key: review.id, review, decorative: false }))
    }
    const cards: { key: string; review: RecentRestaurantReview; decorative: boolean }[] = []
    for (let copy = 0; copy < REVIEW_LOOP_COPIES; copy += 1) {
      for (const review of reviews) {
        cards.push({
          key: `${copy}:${review.id}`,
          review,
          // The middle copy is the real one; the outer copies only keep the
          // swipe continuous, so they stay out of the accessibility tree.
          decorative: copy !== 1,
        })
      }
    }
    return cards
  }, [looping, reviews])

  // Start in the middle copy so the first swipe works in both directions.
  useLayoutEffect(() => {
    const el = scrollRef.current
    if (!el || !looping) return
    const setWidth = measureStep() * reviews.length
    if (setWidth > 0) el.scrollLeft = setWidth
  }, [looping, measureStep, reviews.length, reviews])

  const startAutoScroll = useCallback(() => {
    if (autoScrollTimer.current) return
    autoScrollTimer.current = setInterval(() => {
      const el = scrollRef.current
      if (!el || isHovering.current) return
      const step = measureStep()
      if (!step) return
      scrollTo(el.scrollLeft + step)
    }, REVIEW_AUTO_SCROLL_INTERVAL)
  }, [measureStep, scrollTo])

  const stopAutoScroll = useCallback(() => {
    if (autoScrollTimer.current) {
      clearInterval(autoScrollTimer.current)
      autoScrollTimer.current = null
    }
  }, [])

  useEffect(() => {
    const el = scrollRef.current
    if (!el) return
    updateArrows()
    const onScroll = () => updateArrowsRaf()
    el.addEventListener('scroll', onScroll, { passive: true })
    return () => el.removeEventListener('scroll', onScroll)
  }, [updateArrows, updateArrowsRaf, reviews])

  // A resize changes card width (and therefore a copy's width): recentre so the
  // rail never starts outside the middle copy.
  useEffect(() => {
    const el = scrollRef.current
    if (!el || !looping || typeof ResizeObserver === 'undefined') return
    const observer = new ResizeObserver(() => {
      const setWidth = measureStep() * reviews.length
      if (setWidth <= 0) return
      if (el.scrollLeft <= 1 || el.scrollLeft >= setWidth * 2) {
        el.scrollLeft = setWidth
      }
    })
    observer.observe(el)
    return () => observer.disconnect()
  }, [looping, measureStep, reviews.length, reviews])

  // Ambient auto-scroll only runs while the section is actually on-screen.
  useEffect(() => {
    const el = sectionRef.current
    if (!el || typeof IntersectionObserver === 'undefined') return
    const io = new IntersectionObserver(
      ([entry]) => setSectionVisible(entry.isIntersecting),
      { rootMargin: '200px' },
    )
    io.observe(el)
    return () => io.disconnect()
  }, [reviews])

  useEffect(() => {
    const onVisibility = () => setPageVisible(document.visibilityState !== 'hidden')
    document.addEventListener('visibilitychange', onVisibility)
    return () => document.removeEventListener('visibilitychange', onVisibility)
  }, [])

  useEffect(() => {
    if (isMobile || reduceMotion || !sectionVisible || !pageVisible || reviews.length === 0) {
      stopAutoScroll()
      return
    }
    startAutoScroll()
    return () => stopAutoScroll()
  }, [isMobile, reduceMotion, sectionVisible, pageVisible, reviews, startAutoScroll, stopAutoScroll])

  return (
    <section className="rh-diner-reviews-section" ref={sectionRef}>
      <div className="rh-diner-reviews-container">
        <div className="rh-diner-reviews-viewport">
          <SectionHeading
            title="What Diners Are Saying"
            subtitle="Recent reviews from people who ate and reviewed on Travio."
            viewAllLink="/restaurants?sort=reviews"
            viewAllChevron
            onScrollLeft={() => scroll('left')}
            onScrollRight={() => scroll('right')}
            disableLeft={!canScrollLeft}
            disableRight={!canScrollRight}
          />

          {stats && (
            <div className="rh-diner-reviews-stats">
              <div className="rh-diner-reviews-stats__rating">
                <span className="rh-diner-reviews-stats__number">
                  {stats.averageRating ?? '—'}
                </span>
                <div className="rh-diner-reviews-stats__stars">
                  <StarRating
                    value={stats.averageRating ?? 0}
                    size={16}
                    gap={1}
                    filledColor="#16a34a"
                    emptyColor="#e5e7eb"
                  />
                </div>
              </div>
              <span className="rh-diner-reviews-stats__divider" />
              <span className="rh-diner-reviews-stats__text">
                From <strong>{stats.totalReviews}</strong> reviews
              </span>
            </div>
          )}

          {query.isPending && (
            <div className="rh-home-rail" aria-label="Loading diner reviews">
              {Array.from({ length: 4 }, (_, index) => (
                <div key={index} className="restaurant-skeleton" />
              ))}
            </div>
          )}

          {query.isError && (
            <div className="rh-home-rail-message">
              <p>We could not load diner reviews right now.</p>
              <button type="button" onClick={() => void query.refetch()}>
                Try again
              </button>
            </div>
          )}

          {!query.isPending && !query.isError && reviews.length === 0 && (
            <div className="rh-home-rail-message">
              <p>Diner reviews will appear here once the first visits are verified.</p>
              <Link to="/restaurants">Browse all restaurants</Link>
            </div>
          )}

          {!query.isPending && !query.isError && reviews.length > 0 && (
            <div
              className="rh-diner-reviews-clip"
              onMouseEnter={() => { isHovering.current = true }}
              onMouseLeave={() => { isHovering.current = false }}
            >
              <div
                className="rh-diner-reviews-carousel"
                ref={scrollRef}
                aria-label={looping ? 'Reviews, swipe for more' : undefined}
              >
                {loopedCards.map(({ key, review, decorative }) => (
                  <div
                    key={key}
                    className="rh-diner-reviews-card-wrap"
                    aria-hidden={decorative || undefined}
                  >
                    <DinerReviewCard review={review} decorative={decorative} />
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </section>
  )
}

function useNearbyLocation() {
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null)
  const [locating, setLocating] = useState(false)
  const [failed, setFailed] = useState(false)

  const requestLocation = () => {
    if (!navigator.geolocation) {
      setFailed(true)
      return
    }
    setLocating(true)
    navigator.geolocation.getCurrentPosition(
      ({ coords: position }) => {
        setCoords({ lat: position.latitude, lng: position.longitude })
        setLocating(false)
        setFailed(false)
      },
      () => {
        setFailed(true)
        setLocating(false)
      },
      { maximumAge: 600_000, timeout: 8_000 },
    )
  }

  return { coords, locating, failed, requestLocation }
}

function RestaurantHome() {
  const recommended = useRecommendedRestaurants()
  const popular = useRestaurantVenues({ sort: 'reviews' })
  const topRated = useRestaurantVenues({ sort: 'rating' })
  const highDemand = useLikelyToBookOutRestaurants()
  const offers = useSpecialOfferRestaurants()
  const newest = useRestaurantVenues({ sort: 'newest' })
  const { coords, locating, failed, requestLocation } = useNearbyLocation()
  const nearby = useRestaurantVenues(
    coords
      ? { lat: coords.lat, lng: coords.lng, radiusKm: 10, sort: 'rating' }
      : { city: 'Accra', sort: 'rating' },
  )
  const cuisinePhotos = useCuisinePhotos(CUISINE_PHOTO_QUERIES)

  return (
    <div className="restaurants-page restaurants-page--hero">
      <SEO
        title="Restaurants in Ghana"
        description="Find restaurants in Ghana by city, cuisine and price. Ratings come from Travio reviews, with outside scores shown separately."
        keywords="Ghana restaurants, where to eat in Ghana, Accra restaurants"
        canonical="https://www.travioghana.com/restaurants"
      />

      <Hero />

      <main className="restaurants-page__main">
        <div className="rh-popular-cities">
          <span>Popular cities:</span>
          {CITIES.slice(0, 4).map((city) => (
            <Link key={city} to={`/restaurants?city=${encodeURIComponent(city)}`}>
              {city}
            </Link>
          ))}
        </div>

        <CuisineSection cards={cuisinePhotos.data} />

        <RestaurantRail
          title="Recommended For You"
          description="Picked from diner interest, ratings and places near you."
          query={recommended}
          section="recommended"
          to="/restaurants?section=recommended"
        />

        <RestaurantRail
          title="Popular Restaurants"
          description="Restaurants with the most diner reviews."
          query={popular}
          section="popular"
          to="/restaurants?sort=reviews"
        />

        <RestaurantRail
          title="Top Rated"
          description="Places with the strongest Travio diner ratings."
          query={topRated}
          section="top-rated"
          to="/restaurants?sort=rating"
        />

        <RestaurantRail
          title="Likely To Book Out"
          description="Based on recent Travio diner interest, not live table availability."
          query={highDemand}
          section="likely-to-book-out"
          to="/restaurants?section=likely-to-book-out"
        />

        <RestaurantRail
          title="Special Offers"
          description="Current offers added by the restaurant or Travio team."
          query={offers}
          section="offers"
          to="/restaurants?section=offers"
        />

        <RestaurantRail
          title="New Listings"
          description="New restaurants added to the Ghana guide."
          query={newest}
          section="new-listings"
          to="/restaurants?sort=newest"
        />

        <RestaurantRail
          title={coords ? 'Top Restaurants Nearby' : 'Top Restaurants in Accra'}
          description={
            coords
              ? 'Popular places within 10 km of your location.'
              : failed
                ? 'Location unavailable — showing popular places in Accra.'
                : 'Enable your location to see places near you.'
          }
          query={nearby}
          section="nearby"
          to={coords ? '/restaurants?sort=rating' : '/restaurants?city=Accra'}
          action={
            <button
              className="rh-nearby-button"
              type="button"
              disabled={locating}
              onClick={requestLocation}
            >
              {locating ? 'Locating…' : 'Use my location'}
            </button>
          }
        />

        <DinerReviewsRail />

        <aside className="restaurants-note">
          <MapPin size={16} aria-hidden="true" />
          Restaurants are listed once we have verified details. Outside ratings are never mixed
          into the Travio score.
        </aside>
      </main>

      <Footer />
    </div>
  )
}

type ActiveChip = { key: string; label: string; value?: string }

function activeChips(filters: RestaurantVenueFilters): ActiveChip[] {
  const chips: ActiveChip[] = []
  if (filters.q) chips.push({ key: 'q', label: `Search: ${filters.q}` })
  if (filters.place) chips.push({ key: 'place', label: `Near ${filters.place}` })
  if (filters.city) chips.push({ key: 'city', label: filters.city })
  if (filters.cuisine) chips.push({ key: 'cuisine', label: displayLabel(filters.cuisine) })
  if (filters.dietary) {
    for (const item of filters.dietary) chips.push({ key: 'dietary', label: displayLabel(item), value: item })
  }
  if (filters.priceBand) {
    const band = PRICE_BANDS.find((option) => option.value === String(filters.priceBand))
    chips.push({ key: 'priceBand', label: band?.label ?? `Price ${filters.priceBand}` })
  }
  if (filters.minRating) chips.push({ key: 'minRating', label: `${filters.minRating} and up` })
  if (filters.minReviews) chips.push({ key: 'minReviews', label: `${filters.minReviews}+ reviews` })
  if (filters.featured) chips.push({ key: 'featured', label: 'Featured' })
  if (filters.highDemand) chips.push({ key: 'highDemand', label: 'Likely to book out' })
  if (filters.hasOffer) chips.push({ key: 'hasOffer', label: 'Special offers' })
  return chips
}

function RestaurantResults() {
  const [searchParams, setSearchParams] = useSearchParams()
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false)
  const filters = useMemo(() => buildFilters(searchParams), [searchParams])
  const chips = useMemo(() => activeChips(filters), [filters])
  const { data, isPending, isError, error, refetch, hasNextPage, isFetchingNextPage, fetchNextPage } =
    useRestaurantVenues(filters)

  const sectionParam = searchParams.get('section')
  const section = isRestaurantHomepageSection(sectionParam) ? sectionParam : null
  const sectionIds = useRestaurantSectionIds(section, {
    city: filters.city,
    lat: filters.lat,
    lng: filters.lng,
  })

  const allVenues = useMemo(() => data?.pages.flatMap((page) => page.venues) ?? [], [data])
  const venues = useMemo(() => {
    if (!section || !sectionIds.data) return allVenues
    const byId = new Map(allVenues.map((venue) => [venue.id, venue]))
    return sectionIds.data
      .map((id) => byId.get(id))
      .filter((venue): venue is RestaurantVenue => venue != null)
  }, [allVenues, section, sectionIds.data])
  const dietary = filters.dietary ?? []

  const updateParams = (patch: Record<string, string | null>) => {
    const next = new URLSearchParams(searchParams)
    for (const [key, value] of Object.entries(patch)) {
      if (value) next.set(key, value)
      else next.delete(key)
    }
    next.delete('cursor')
    setSearchParams(next, { replace: true })
  }

  const clearFilters = () => {
    const next = new URLSearchParams()
    next.delete('section')
    if (filters.sort) next.set('sort', filters.sort)
    setSearchParams(next, { replace: true })
    setMobileFiltersOpen(false)
  }

  const removeChip = (chip: ActiveChip) => {
    if (chip.key === 'dietary') {
      const remaining = dietary.filter((item) => item !== chip.value)
      updateParams({ dietary: remaining.length ? remaining.join(',') : null })
      return
    }
    if (chip.key === 'place') {
      updateParams({ place: null, lat: null, lng: null, radiusKm: null })
      return
    }
    updateParams({ [chip.key]: null })
  }

  const submitSearch = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const value = String(new FormData(event.currentTarget).get('q') || '').trim()
    updateParams({ q: value || null })
    trackRestaurantSearch(value, filters.city, filters.cuisine)
  }

  const toggleDietary = (value: string, checked: boolean) => {
    const next = new Set(dietary)
    if (checked) next.add(value)
    else next.delete(value)
    updateParams({ dietary: next.size ? [...next].join(',') : null })
  }

  return (
    <div className="restaurants-page restaurants-page--results">
      <SEO
        title="Restaurants in Ghana"
        description="Filter Ghana restaurants by city, cuisine, price, rating and dietary needs. Ratings come from Travio reviews."
        keywords="Ghana restaurants, Accra restaurants, restaurants by cuisine"
        canonical="https://www.travioghana.com/restaurants"
      />

      <main className="restaurants-page__main">
        <nav className="rh-breadcrumb" aria-label="Breadcrumb">
          <Link to="/">Home</Link>
          <span aria-hidden="true">/</span>
          <span>Restaurants</span>
        </nav>

        <div className="rh-results-switch">
          <VerticalSwitch />
        </div>

        <div className="rh-results-heading">
          <div>
            <h1>Restaurants in Ghana</h1>
            <p>Narrow the list by city, cuisine, price and what diners reported.</p>
          </div>
          <label className="rh-sort">
            <span>Sort by</span>
            <select
              value={filters.sort ?? 'rating'}
              onChange={(event) => updateParams({ sort: event.target.value || null })}
            >
              {SORTS.map((sort) => (
                <option key={sort.value} value={sort.value}>
                  {sort.label}
                </option>
              ))}
            </select>
          </label>
        </div>

        <button
          className="rh-mobile-filter-toggle"
          type="button"
          aria-expanded={mobileFiltersOpen}
          onClick={() => setMobileFiltersOpen((open) => !open)}
        >
          <SlidersHorizontal size={16} aria-hidden="true" />
          {mobileFiltersOpen ? 'Hide filters' : 'Show filters'}
          {chips.length > 0 && <span>{chips.length}</span>}
        </button>

        {chips.length > 0 && (
          <div className="rh-active-filters" aria-label="Active filters">
            {chips.map((chip) => (
              <button
                key={`${chip.key}-${chip.value ?? chip.label}`}
                type="button"
                onClick={() => removeChip(chip)}
                aria-label={`Remove ${chip.label} filter`}
              >
                {chip.label}
                <span aria-hidden="true">×</span>
              </button>
            ))}
            <button className="rh-active-filters__clear" type="button" onClick={clearFilters}>
              Clear all
            </button>
          </div>
        )}

        <div className="rh-results-layout">
          <aside
            className={`rh-filters${mobileFiltersOpen ? ' rh-filters--open' : ''}`}
            aria-label="Restaurant filters"
            data-lenis-prevent
          >
            <div className="rh-filters__head">
              <h2>Filters</h2>
              {chips.length > 0 && (
                <button type="button" onClick={clearFilters}>
                  Clear all
                </button>
              )}
            </div>

            <form
              key={`results-${searchParams.toString()}`}
              className="rh-filters__search"
              onSubmit={submitSearch}
            >
              <Search size={16} aria-hidden="true" />
              <input
                name="q"
                type="search"
                defaultValue={filters.q ?? ''}
                placeholder="Search restaurants"
                aria-label="Search restaurants"
              />
              <button type="submit">Go</button>
            </form>

            <fieldset className="rh-filter-group">
              <legend>City</legend>
              <label>
                <input
                  type="radio"
                  name="city"
                  checked={!filters.city}
                  onChange={() =>
                    updateParams({ city: null, place: null, lat: null, lng: null, radiusKm: null })
                  }
                />
                All cities
              </label>
              {CITIES.map((city) => (
                <label key={city}>
                  <input
                    type="radio"
                    name="city"
                    checked={filters.city === city}
                    onChange={() =>
                      updateParams({ city, place: null, lat: null, lng: null, radiusKm: null })
                    }
                  />
                  {city}
                </label>
              ))}
            </fieldset>

            <fieldset className="rh-filter-group">
              <legend>Cuisine</legend>
              <label>
                <input
                  type="radio"
                  name="cuisine"
                  checked={!filters.cuisine}
                  onChange={() => updateParams({ cuisine: null })}
                />
                Any cuisine
              </label>
              {CUISINES.map(({ label }) => (
                <label key={label}>
                  <input
                    type="radio"
                    name="cuisine"
                    checked={filters.cuisine === label.toLowerCase()}
                    onChange={() => updateParams({ cuisine: label.toLowerCase() })}
                  />
                  {label}
                </label>
              ))}
            </fieldset>

            <fieldset className="rh-filter-group">
              <legend>Price</legend>
              <label>
                <input
                  type="radio"
                  name="priceBand"
                  checked={!filters.priceBand}
                  onChange={() => updateParams({ priceBand: null })}
                />
                Any price
              </label>
              {PRICE_BANDS.map((band) => (
                <label key={band.value}>
                  <input
                    type="radio"
                    name="priceBand"
                    checked={filters.priceBand?.toString() === band.value}
                    onChange={() => updateParams({ priceBand: band.value })}
                  />
                  {band.label}
                </label>
              ))}
            </fieldset>

            <fieldset className="rh-filter-group">
              <legend>Travio rating</legend>
              <label>
                <input
                  type="radio"
                  name="minRating"
                  checked={!filters.minRating}
                  onChange={() => updateParams({ minRating: null })}
                />
                Any rating
              </label>
              {MIN_RATINGS.map((rating) => (
                <label key={rating.value}>
                  <input
                    type="radio"
                    name="minRating"
                    checked={filters.minRating?.toString() === rating.value}
                    onChange={() => updateParams({ minRating: rating.value })}
                  />
                  {rating.label}
                </label>
              ))}
            </fieldset>

            <fieldset className="rh-filter-group">
              <legend>Dietary needs</legend>
              {DIETARY.map((item) => (
                <label key={item}>
                  <input
                    type="checkbox"
                    checked={dietary.includes(item)}
                    onChange={(event) => toggleDietary(item, event.target.checked)}
                  />
                  {displayLabel(item)}
                </label>
              ))}
            </fieldset>

            <fieldset className="rh-filter-group">
              <legend>Minimum reviews</legend>
              <label>
                <input
                  type="radio"
                  name="minReviews"
                  checked={!filters.minReviews}
                  onChange={() => updateParams({ minReviews: null })}
                />
                Any number
              </label>
              {MIN_REVIEWS.map((count) => (
                <label key={count.value}>
                  <input
                    type="radio"
                    name="minReviews"
                    checked={filters.minReviews?.toString() === count.value}
                    onChange={() => updateParams({ minReviews: count.value })}
                  />
                  {count.label}
                </label>
              ))}
            </fieldset>

            <fieldset className="rh-filter-group">
              <legend>Listing</legend>
              <label>
                <input
                  type="checkbox"
                  checked={Boolean(filters.featured)}
                  onChange={(event) => updateParams({ featured: event.target.checked ? 'true' : null })}
                />
                Featured restaurants
              </label>
              <label>
                <input
                  type="checkbox"
                  checked={Boolean(filters.highDemand)}
                  onChange={(event) =>
                    updateParams({ highDemand: event.target.checked ? 'true' : null })
                  }
                />
                Likely to book out
              </label>
              <label>
                <input
                  type="checkbox"
                  checked={Boolean(filters.hasOffer)}
                  onChange={(event) => updateParams({ hasOffer: event.target.checked ? 'true' : null })}
                />
                Special offers
              </label>
            </fieldset>
          </aside>

          <section className="rh-results-results" aria-live="polite">
            {isPending && (
              <>
                <p className="restaurants-count">Loading restaurants…</p>
                <div className="restaurants-grid">
                  {Array.from({ length: 6 }, (_, index) => (
                    <div key={index} className="restaurant-skeleton" />
                  ))}
                </div>
              </>
            )}

            {isError && (
              <div className="restaurants-state">
                <h2>We could not load restaurants</h2>
                <p>{error instanceof Error ? error.message : 'Check your connection and try again.'}</p>
                <button type="button" onClick={() => void refetch()}>
                  Try again
                </button>
              </div>
            )}

            {!isPending && !isError && venues.length === 0 && (
              <div className="restaurants-state">
                <h2>No restaurants match yet</h2>
                <p>Try another city or clear your filters.</p>
                <div className="restaurants-state__actions">
                  {chips.length > 0 && (
                    <button type="button" onClick={clearFilters}>
                      Clear filters
                    </button>
                  )}
                  <Link to="/">Browse tours and activities</Link>
                </div>
              </div>
            )}

            {!isPending && !isError && venues.length > 0 && (
              <>
                <p className="restaurants-count">
                  Showing {venues.length} {venues.length === 1 ? 'place' : 'places'}
                  {filters.place ? ` near ${filters.place}` : filters.city ? ` in ${filters.city}` : ''}
                </p>
                <div className="restaurants-grid">
                  {venues.map((venue, index) => (
                    <RestaurantCard
                      key={venue.id}
                      venue={venue}
                      section={section ?? 'restaurant'}
                      position={index}
                    />
                  ))}
                </div>
                {hasNextPage && !section && (
                  <button
                    className="restaurants-load-more"
                    type="button"
                    disabled={isFetchingNextPage}
                    onClick={() => void fetchNextPage()}
                  >
                    {isFetchingNextPage ? 'Loading more…' : 'Show more restaurants'}
                  </button>
                )}
              </>
            )}
          </section>
        </div>

        <aside className="restaurants-note">
          <MapPin size={16} aria-hidden="true" />
          Restaurants are listed once we have verified details. Outside ratings are never mixed
          into the Travio score.
        </aside>
      </main>

      <Footer />
    </div>
  )
}

export default function RestaurantsPage() {
  const [searchParams] = useSearchParams()
  return Array.from(searchParams.keys()).length > 0 ? <RestaurantResults /> : <RestaurantHome />
}
