import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { MapPin, Search, UtensilsCrossed } from 'lucide-react'
import {
  useRestaurantSearch,
  type RestaurantPlaceSuggestion,
} from '../hooks/useRestaurantSearch'
import type { RestaurantVenue } from '../hooks/useRestaurantVenues'
import OptimizedImage from './shared/OptimizedImage'

type SearchItem =
  | { kind: 'restaurant'; venue: RestaurantVenue }
  | { kind: 'place'; place: RestaurantPlaceSuggestion }

function displayLabel(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1)
}

function restaurantMeta(venue: RestaurantVenue): string {
  if (venue.rating != null) {
    const reviews = `${venue.reviewCount} Travio ${venue.reviewCount === 1 ? 'review' : 'reviews'}`
    return `${venue.rating.toFixed(1)} · ${reviews}`
  }
  if (venue.external?.rating != null) {
    const source = venue.external.source === 'TRIPADVISOR' ? 'Tripadvisor' : displayLabel(venue.external.source)
    return `${source} ${venue.external.rating.toFixed(1)} · external`
  }
  return 'New on Travio'
}

export default function RestaurantSearchBar() {
  const navigate = useNavigate()
  const [value, setValue] = useState('')
  const [open, setOpen] = useState(false)
  const [highlighted, setHighlighted] = useState(-1)
  const containerRef = useRef<HTMLDivElement>(null)
  const { restaurants, places, isSearching, hasQuery } = useRestaurantSearch(value)

  const items = useMemo<SearchItem[]>(
    () => [
      ...restaurants.map((venue) => ({ kind: 'restaurant' as const, venue })),
      ...places.map((place) => ({ kind: 'place' as const, place })),
    ],
    [restaurants, places],
  )

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const choose = useCallback(
    (item: SearchItem) => {
      setOpen(false)
      if (item.kind === 'restaurant') {
        navigate(`/restaurants/${item.venue.slug}`)
        return
      }

      const { place } = item
      if (place.latitude == null || place.longitude == null) {
        navigate(`/restaurants?q=${encodeURIComponent(place.name)}`)
        return
      }

      const params = new URLSearchParams({
        lat: String(place.latitude),
        lng: String(place.longitude),
        radiusKm: String(place.radiusKm ?? 10),
        place: place.name,
      })
      navigate(`/restaurants?${params.toString()}`)
    },
    [navigate],
  )

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (highlighted >= 0 && items[highlighted]) {
      choose(items[highlighted])
      return
    }
    const q = value.trim()
    if (!q) return
    setOpen(false)
    navigate(`/restaurants?q=${encodeURIComponent(q)}`)
  }

  const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Escape') {
      setOpen(false)
      setHighlighted(-1)
      return
    }
    if (event.key === 'ArrowDown') {
      event.preventDefault()
      setOpen(true)
      if (items.length) setHighlighted((current) => (current + 1) % items.length)
      return
    }
    if (event.key === 'ArrowUp') {
      event.preventDefault()
      if (items.length) {
        setHighlighted((current) => (current <= 0 ? items.length - 1 : current - 1))
      }
    }
  }

  const showPanel = open && hasQuery
  const restaurantItems = restaurants.map((venue, index) => ({ venue, index }))
  const placeItems = places.map((place, index) => ({ place, index: restaurants.length + index }))

  return (
    <div className="rh-restaurant-search" ref={containerRef}>
      <form className="rh-home-search" onSubmit={submit} role="search">
        <Search size={18} aria-hidden="true" />
        <input
          value={value}
          onChange={(event) => {
            setValue(event.target.value)
            setHighlighted(-1)
            setOpen(true)
          }}
          onFocus={() => setOpen(true)}
          onBlur={() => window.setTimeout(() => setOpen(false), 120)}
          onKeyDown={handleKeyDown}
          type="search"
          placeholder="Restaurant, cuisine, neighbourhood or city"
          aria-label="Search restaurants by name or place"
          aria-autocomplete="list"
          aria-expanded={showPanel}
          aria-controls="restaurant-search-results"
          role="combobox"
        />
        <button type="submit">Search restaurants</button>
      </form>

      {showPanel && (
        <div
          id="restaurant-search-results"
          className="rh-restaurant-search__panel"
          role="listbox"
          aria-label="Restaurant and place suggestions"
          onMouseDown={(event) => event.preventDefault()}
        >
          {isSearching && items.length === 0 && (
            <p className="rh-restaurant-search__state">Searching restaurants and places…</p>
          )}

          {restaurants.length > 0 && (
            <div className="rh-restaurant-search__group">
              <p className="rh-restaurant-search__heading">Restaurants</p>
              {restaurantItems.map(({ venue, index }) => (
                <button
                  key={venue.id}
                  type="button"
                  role="option"
                  aria-selected={highlighted === index}
                  className={`rh-restaurant-search__option${highlighted === index ? ' is-highlighted' : ''}`}
                  onMouseEnter={() => setHighlighted(index)}
                  onClick={() => choose({ kind: 'restaurant', venue })}
                >
                  <span className="rh-restaurant-search__thumb">
                    {venue.coverPhoto ? (
                      <OptimizedImage src={venue.coverPhoto} alt="" width={52} height={52} fit="crop" />
                    ) : (
                      <UtensilsCrossed size={18} aria-hidden="true" />
                    )}
                  </span>
                  <span className="rh-restaurant-search__text">
                    <span className="rh-restaurant-search__title">{venue.name}</span>
                    <span className="rh-restaurant-search__subtitle">
                      {[venue.neighbourhood, venue.city].filter(Boolean).join(', ') || 'Ghana'}
                      {venue.cuisines.length > 0
                        ? ` · ${venue.cuisines.slice(0, 2).map(displayLabel).join(' · ')}`
                        : ''}
                    </span>
                    <span className="rh-restaurant-search__meta">{restaurantMeta(venue)}</span>
                  </span>
                  <span className="rh-restaurant-search__badge">Restaurant</span>
                </button>
              ))}
            </div>
          )}

          {places.length > 0 && (
            <div className="rh-restaurant-search__group">
              <p className="rh-restaurant-search__heading">Places</p>
              {placeItems.map(({ place, index }) => (
                <button
                  key={`${place.name}-${place.latitude}-${place.longitude}`}
                  type="button"
                  role="option"
                  aria-selected={highlighted === index}
                  className={`rh-restaurant-search__option${highlighted === index ? ' is-highlighted' : ''}`}
                  onMouseEnter={() => setHighlighted(index)}
                  onClick={() => choose({ kind: 'place', place })}
                >
                  <span className="rh-restaurant-search__thumb rh-restaurant-search__thumb--place">
                    <MapPin size={18} aria-hidden="true" />
                  </span>
                  <span className="rh-restaurant-search__text">
                    <span className="rh-restaurant-search__title">{place.name}</span>
                    <span className="rh-restaurant-search__subtitle">
                      {place.subtitle || 'Ghana'}
                    </span>
                    <span className="rh-restaurant-search__meta">
                      {place.restaurantCount}{' '}
                      {place.restaurantCount === 1 ? 'restaurant' : 'restaurants'} nearby
                    </span>
                  </span>
                  <span className="rh-restaurant-search__badge rh-restaurant-search__badge--place">
                    Place
                  </span>
                </button>
              ))}
            </div>
          )}

          {!isSearching && items.length === 0 && (
            <p className="rh-restaurant-search__state">
              No restaurant or place matches “{value.trim()}”. Try a town, cuisine or restaurant name.
            </p>
          )}
        </div>
      )}
    </div>
  )
}
