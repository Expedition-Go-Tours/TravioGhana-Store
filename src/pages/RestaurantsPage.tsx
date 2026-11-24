import { useMemo, type FormEvent } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { MapPin, Search } from 'lucide-react'
import SEO from '../components/SEO'
import Footer from '../components/Footer'
import RestaurantCard from '../components/RestaurantCard'
import {
  useRestaurantVenues,
  type RestaurantSort,
  type RestaurantVenueFilters,
} from '../hooks/useRestaurantVenues'
import './RestaurantsPage.css'

const CITIES = ['Accra', 'Kumasi', 'Cape Coast', 'Takoradi', 'Tamale', 'Elmina']
const CUISINES = ['Ghanaian', 'Nigerian', 'Chinese', 'Indian', 'Italian', 'Seafood', 'Vegetarian']

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

function optionalNumber(value: string | null): number | undefined {
  if (!value) return undefined
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : undefined
}

function parseSort(value: string | null): RestaurantSort | undefined {
  return SORTS.some((option) => option.value === value) ? (value as RestaurantSort) : undefined
}

function buildFilters(params: URLSearchParams): RestaurantVenueFilters {
  return {
    q: params.get('q') || undefined,
    city: params.get('city') || undefined,
    cuisine: params.get('cuisine') || undefined,
    priceBand: optionalNumber(params.get('priceBand')),
    minRating: optionalNumber(params.get('minRating')),
    featured: params.get('featured') === 'true' || undefined,
    sort: parseSort(params.get('sort')),
  }
}

export default function RestaurantsPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const filters = useMemo(() => buildFilters(searchParams), [searchParams])
  const { data, isPending, isError, error, refetch, hasNextPage, isFetchingNextPage, fetchNextPage } =
    useRestaurantVenues(filters)

  const venues = data?.pages.flatMap((page) => page.venues) ?? []
  const activeFilters = Object.values(filters).filter((value) => value !== undefined).length

  const updateParams = (patch: Record<string, string | null>) => {
    const next = new URLSearchParams(searchParams)
    for (const [key, value] of Object.entries(patch)) {
      if (value) next.set(key, value)
      else next.delete(key)
    }
    next.delete('cursor')
    setSearchParams(next, { replace: true })
  }

  const clearFilters = () => setSearchParams(new URLSearchParams(), { replace: true })

  const submitSearch = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const value = String(new FormData(event.currentTarget).get('q') || '').trim()
    updateParams({ q: value || null })
  }

  return (
    <div className="restaurants-page">
      <SEO
        title="Restaurants in Ghana"
        description="Find restaurants in Ghana by city, cuisine and price. Ratings come from Travio reviews, with outside scores shown separately."
        keywords="Ghana restaurants, where to eat in Ghana, Accra restaurants"
        canonical="https://www.travioghana.com/restaurants"
      />

      <main className="restaurants-page__main">
        <section className="restaurants-hero">
          <span className="restaurants-hero__eyebrow">Travio Ghana</span>
          <h1>Restaurants in Ghana</h1>
          <p>
            Find a place by city, cuisine or price. Ratings come from Travio reviews; outside
            scores are labelled with their source.
          </p>
        </section>

        <section className="restaurants-controls" aria-label="Restaurant filters">
          <form
            key={`search-${searchParams.toString()}`}
            className="restaurants-search"
            onSubmit={submitSearch}
          >
            <Search size={18} aria-hidden="true" />
            <input
              name="q"
              type="search"
              defaultValue={filters.q ?? ''}
              placeholder="Restaurant, neighbourhood or city"
              aria-label="Search restaurants"
            />
            <button type="submit">Search</button>
          </form>

          <div className="restaurants-filters">
            <label>
              <span>City</span>
              <select
                value={filters.city ?? ''}
                onChange={(event) => updateParams({ city: event.target.value || null })}
              >
                <option value="">All cities</option>
                {CITIES.map((city) => (
                  <option key={city} value={city}>
                    {city}
                  </option>
                ))}
              </select>
            </label>

            <label>
              <span>Cuisine</span>
              <select
                value={filters.cuisine ?? ''}
                onChange={(event) => updateParams({ cuisine: event.target.value || null })}
              >
                <option value="">Any cuisine</option>
                {CUISINES.map((cuisine) => (
                  <option key={cuisine} value={cuisine}>
                    {cuisine}
                  </option>
                ))}
              </select>
            </label>

            <label>
              <span>Price</span>
              <select
                value={filters.priceBand?.toString() ?? ''}
                onChange={(event) => updateParams({ priceBand: event.target.value || null })}
              >
                <option value="">Any price</option>
                {PRICE_BANDS.map((band) => (
                  <option key={band.value} value={band.value}>
                    {band.label}
                  </option>
                ))}
              </select>
            </label>

            <label>
              <span>Rating</span>
              <select
                value={filters.minRating?.toString() ?? ''}
                onChange={(event) => updateParams({ minRating: event.target.value || null })}
              >
                <option value="">Any rating</option>
                {MIN_RATINGS.map((rating) => (
                  <option key={rating.value} value={rating.value}>
                    {rating.label}
                  </option>
                ))}
              </select>
            </label>

            <label>
              <span>Sort</span>
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

            <label className="restaurants-toggle">
              <input
                type="checkbox"
                checked={Boolean(filters.featured)}
                onChange={(event) => updateParams({ featured: event.target.checked ? 'true' : null })}
              />
              Featured only
            </label>
          </div>

          {activeFilters > 0 && (
            <button className="restaurants-clear" type="button" onClick={clearFilters}>
              Clear filters
            </button>
          )}
        </section>

        <section className="restaurants-results" aria-live="polite">
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
                {activeFilters > 0 && (
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
                {filters.city ? ` in ${filters.city}` : ''}
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
