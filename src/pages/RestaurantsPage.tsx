import { useMemo, useState, type FormEvent } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import {
  ArrowUpRight,
  Fish,
  Flame,
  Leaf,
  MapPin,
  Pizza,
  Search,
  SlidersHorizontal,
  Soup,
  UtensilsCrossed,
  type LucideIcon,
} from 'lucide-react'
import SEO from '../components/SEO'
import Footer from '../components/Footer'
import Hero from '../components/Hero'
import VerticalSwitch from '../components/VerticalSwitch'
import RestaurantCard from '../components/RestaurantCard'
import {
  useRestaurantVenues,
  type RestaurantSort,
  type RestaurantVenueFilters,
} from '../hooks/useRestaurantVenues'
import ghanaianImage from '../assets/restaurants/cuisine-ghanaian.webp'
import nigerianImage from '../assets/restaurants/cuisine-nigerian.webp'
import chineseImage from '../assets/restaurants/cuisine-chinese.webp'
import indianImage from '../assets/restaurants/cuisine-indian.webp'
import italianImage from '../assets/restaurants/cuisine-italian.webp'
import seafoodImage from '../assets/restaurants/cuisine-seafood.webp'
import vegetarianImage from '../assets/restaurants/cuisine-vegetarian.webp'
import './RestaurantsPage.css'

const CITIES = ['Accra', 'Kumasi', 'Cape Coast', 'Takoradi', 'Tamale', 'Elmina']
const DIETARY = ['vegetarian', 'vegan', 'gluten-free', 'halal']

type Cuisine = {
  label: string
  note: string
  image: string
  Icon: LucideIcon
}

const CUISINES: Cuisine[] = [
  {
    label: 'Ghanaian',
    note: 'Jollof, banku & soups',
    image: ghanaianImage,
    Icon: UtensilsCrossed,
  },
  {
    label: 'Nigerian',
    note: 'Suya, pepper soup & rice',
    image: nigerianImage,
    Icon: Flame,
  },
  {
    label: 'Chinese',
    note: 'Noodles, dumplings & wok',
    image: chineseImage,
    Icon: Soup,
  },
  {
    label: 'Indian',
    note: 'Curry, thali & tandoor',
    image: indianImage,
    Icon: Soup,
  },
  {
    label: 'Italian',
    note: 'Pasta, pizza & espresso',
    image: italianImage,
    Icon: Pizza,
  },
  {
    label: 'Seafood',
    note: 'Grilled catch & pepper',
    image: seafoodImage,
    Icon: Fish,
  },
  {
    label: 'Vegetarian',
    note: 'Plant-based plates & sides',
    image: vegetarianImage,
    Icon: Leaf,
  },
]

const SORTS: { value: RestaurantSort; label: string }[] = [
  { value: 'rating', label: 'Top rated' },
  { value: 'reviews', label: 'Most reviewed' },
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

function RestaurantRail({
  title,
  description,
  query,
  to,
}: {
  title: string
  description: string
  query: VenueQuery
  to: string
}) {
  const venues = query.data?.pages.flatMap((page) => page.venues) ?? []

  return (
    <section className="rh-home-section">
      <div className="rh-section-head">
        <div>
          <h2>{title}</h2>
          <p>{description}</p>
        </div>
        <Link to={to}>See all</Link>
      </div>

      {query.isPending && (
        <div className="rh-home-rail" aria-label={`Loading ${title}`}>
          {Array.from({ length: 4 }, (_, index) => (
            <div key={index} className="restaurant-skeleton" />
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

      {!query.isPending && !query.isError && venues.length > 0 && (
        <div className="rh-home-rail">
          {venues.map((venue) => (
            <RestaurantCard key={venue.id} venue={venue} />
          ))}
        </div>
      )}
    </section>
  )
}

function RestaurantHome() {
  const topRated = useRestaurantVenues({ sort: 'rating' })
  const newest = useRestaurantVenues({ sort: 'newest' })

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

        <section className="rh-home-section rh-cuisine-section">
          <div className="rh-section-head">
            <div>
              <span className="rh-cuisine-kicker">Explore by cuisine</span>
              <h2>What are you in the mood for?</h2>
              <p>Choose a cuisine and we’ll show you the places serving it.</p>
            </div>
          </div>
          <div className="rh-category-grid">
            {CUISINES.map(({ label, note, image, Icon }, index) => (
              <div
                key={label}
                className="rh-category-tile-shell"
                style={{ animationDelay: `${index * 60}ms` }}
              >
                <Link
                  className="rh-category-tile"
                  to={`/restaurants?cuisine=${encodeURIComponent(label.toLowerCase())}`}
                  aria-label={`See ${label} restaurants in Ghana`}
                >
                  <img
                    className="rh-category-tile__image"
                    src={image}
                    alt=""
                    width={560}
                    height={700}
                    loading="lazy"
                    decoding="async"
                  />
                  <span className="rh-category-tile__scrim" aria-hidden="true" />
                  <span className="rh-category-tile__top" aria-hidden="true">
                    <span className="rh-category-tile__icon">
                      <Icon size={18} strokeWidth={1.9} />
                    </span>
                    <span className="rh-category-tile__arrow">
                      <ArrowUpRight size={16} strokeWidth={2} />
                    </span>
                  </span>
                  <span className="rh-category-tile__body">
                    <span className="rh-category-tile__index">
                      {String(index + 1).padStart(2, '0')}
                    </span>
                    <span className="rh-category-tile__name">{label}</span>
                    <span className="rh-category-tile__note">{note}</span>
                  </span>
                </Link>
              </div>
            ))}
          </div>
        </section>

        <RestaurantRail
          title="Top rated on Travio"
          description="Places with the strongest Travio diner ratings."
          query={topRated}
          to="/restaurants?sort=rating"
        />

        <RestaurantRail
          title="Recently added"
          description="New restaurants added to the Ghana guide."
          query={newest}
          to="/restaurants?sort=newest"
        />

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
  return chips
}

function RestaurantResults() {
  const [searchParams, setSearchParams] = useSearchParams()
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false)
  const filters = useMemo(() => buildFilters(searchParams), [searchParams])
  const chips = useMemo(() => activeChips(filters), [filters])
  const { data, isPending, isError, error, refetch, hasNextPage, isFetchingNextPage, fetchNextPage } =
    useRestaurantVenues(filters)

  const venues = data?.pages.flatMap((page) => page.venues) ?? []
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
                  {venues.map((venue) => (
                    <RestaurantCard key={venue.id} venue={venue} />
                  ))}
                </div>
                {hasNextPage && (
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
