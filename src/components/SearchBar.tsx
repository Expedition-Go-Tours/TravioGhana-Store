import { useState, useRef, useEffect, useCallback, useMemo } from 'react'
import { AnimatePresence, MotionConfig, motion, type Variants } from 'framer-motion'
import { useNavigate } from 'react-router-dom'
import { MapPin, Search, UtensilsCrossed } from 'lucide-react'
import { tourPath } from '../lib/tourPath'
import { useTranslation } from 'react-i18next'
import { useSearchAutocomplete, type SearchSuggestion } from '../hooks/useSearchAutocomplete'
import {
  useRestaurantSearch,
  type RestaurantPlaceSuggestion,
} from '../hooks/useRestaurantSearch'
import type { RestaurantVenue } from '../hooks/useRestaurantVenues'
import { useRecentSearches, type RecentSearch } from '../hooks/useRecentSearches'
import { useLocationSearch } from '../context/LocationSearchContext'
import { useSearchInput } from '../context/SearchInputContext'
import { trackSearch } from '../lib/analytics'
import type { HeroVariant } from '../lib/heroVertical'
import SearchSuggestionIcon from './shared/SearchSuggestionIcon'
import OptimizedImage from './shared/OptimizedImage'
import './SearchBar.css'

interface SearchBarProps {
  variant?: HeroVariant
}

type RestaurantSuggestion =
  | {
      kind: 'restaurant'
      id: string
      name: string
      subtitle: string
      meta: string
      badge: string
      image: string | null
      venue: RestaurantVenue
    }
  | {
      kind: 'place'
      id: string
      name: string
      subtitle: string
      meta: string
      badge: string
      place: RestaurantPlaceSuggestion
    }

function displayLabel(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1)
}

function restaurantMeta(venue: RestaurantVenue): string {
  if (venue.rating != null) {
    const reviews = `${venue.reviewCount} Travio ${venue.reviewCount === 1 ? 'review' : 'reviews'}`
    return `${venue.rating.toFixed(1)} · ${reviews}`
  }
  if (venue.external?.rating != null) {
    const source = venue.external.source === 'TRIPADVISOR'
      ? 'Tripadvisor'
      : displayLabel(venue.external.source)
    return `${source} ${venue.external.rating.toFixed(1)} · external`
  }
  return 'New on Travio'
}

function toRestaurantSuggestions(
  restaurants: RestaurantVenue[],
  places: RestaurantPlaceSuggestion[],
): RestaurantSuggestion[] {
  return [
    ...restaurants.map((venue) => ({
      kind: 'restaurant' as const,
      id: `restaurant-${venue.id}`,
      name: venue.name,
      subtitle: [venue.neighbourhood, venue.city].filter(Boolean).join(', ') || 'Ghana',
      meta: venue.cuisines.length > 0
        ? `${venue.cuisines.slice(0, 2).map(displayLabel).join(' · ')} · ${restaurantMeta(venue)}`
        : restaurantMeta(venue),
      badge: 'Restaurant',
      image: venue.coverPhoto,
      venue,
    })),
    ...places.map((place) => ({
      kind: 'place' as const,
      id: `place-${place.name}-${place.latitude}-${place.longitude}`,
      name: place.name,
      subtitle: place.subtitle || 'Ghana',
      meta: `${place.restaurantCount} ${place.restaurantCount === 1 ? 'restaurant' : 'restaurants'} nearby`,
      badge: 'Place',
      place,
    })),
  ]
}

const dropdownVariants: Variants = {
  hidden: { opacity: 0, y: -8, scale: 0.985 },
  show: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: { duration: 0.18, ease: 'easeOut' },
  },
  exit: {
    opacity: 0,
    y: -8,
    scale: 0.985,
    transition: { duration: 0.15, ease: 'easeIn' },
  },
}

function suggestionKindClass(kind: string) {
  if (kind === 'attraction') return ' suggestion--attraction'
  if (kind === 'region') return ' suggestion--region'
  if (kind === 'tour') return ' suggestion--tour'
  return ' suggestion--place'
}

export default function SearchBar({ variant = 'tours' }: SearchBarProps) {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { setLocation } = useLocationSearch()
  const { searchValue, setSearchValue } = useSearchInput()
  const isRestaurants = variant === 'restaurants'
  const [restaurantValue, setRestaurantValue] = useState('')
  const activeValue = isRestaurants ? restaurantValue : searchValue
  const [showDropdown, setShowDropdown] = useState(false)
  const [highlightedIndex, setHighlightedIndex] = useState(-1)
  const [isFocused, setIsFocused] = useState(false)
  const [isPersonalizing, setIsPersonalizing] = useState(false)
  const {
    suggestions,
    isSearching: isTourSearching,
    stats,
  } = useSearchAutocomplete(activeValue)
  const {
    restaurants,
    places,
    isSearching: isRestaurantSearching,
  } = useRestaurantSearch(isRestaurants ? activeValue : '')
  const { recentSearches, addSearch, removeSearch, clearAll } = useRecentSearches()
  const containerRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const barRef = useRef<HTMLDivElement>(null)
  const dropdownRef = useRef<HTMLDivElement>(null)
  const suppressBlurRef = useRef(false)

  const isSearching = isRestaurants ? isRestaurantSearching : isTourSearching
  const restaurantSuggestions = useMemo(
    () => isRestaurants ? toRestaurantSuggestions(restaurants, places) : [],
    [isRestaurants, restaurants, places],
  )
  const setActiveValue = useCallback((next: string) => {
    if (isRestaurants) setRestaurantValue(next)
    else setSearchValue(next)
  }, [isRestaurants, setSearchValue])

  const navigateToSuggestion = useCallback((suggestion: SearchSuggestion) => {
    setShowDropdown(false)
    setActiveValue('')
    setHighlightedIndex(-1)
    setIsFocused(false)
    inputRef.current?.blur()

    // Tour: go to product page, set region for homepage personalization
    if (suggestion.kind === 'tour' && suggestion.slug) {
      addSearch({ id: suggestion.tourId, slug: suggestion.slug, title: suggestion.name, type: 'tour', image: suggestion.image, city: suggestion.city, region: suggestion.region })
      if (suggestion.region) setLocation(suggestion.region)
      navigate(tourPath(suggestion.tourId, suggestion.slug))
      return
    }

    // Attraction: go to search results with attraction param, set region
    if (suggestion.kind === 'attraction') {
      addSearch({ slug: suggestion.name, title: suggestion.name, type: 'destination', region: suggestion.region })
      if (suggestion.region) setLocation(suggestion.region)
      setIsPersonalizing(true)
      navigate(`/tours?attraction=${encodeURIComponent(suggestion.name)}&place=${encodeURIComponent(suggestion.region || '')}`)
      return
    }

    // Place: go to place-scoped listing, set region for homepage personalization
    if (suggestion.kind === 'place') {
      addSearch({ slug: suggestion.name, title: suggestion.name, type: 'destination', region: suggestion.region })
      if (suggestion.region) setLocation(suggestion.region)
      setIsPersonalizing(true)
      navigate(`/tours?place=${encodeURIComponent(suggestion.name)}`)
      return
    }

    // Region: go to region listing, set region for homepage personalization
    if (suggestion.kind === 'region') {
      addSearch({ slug: suggestion.name, title: suggestion.name, type: 'destination', region: suggestion.region })
      // suggestion.name is e.g. "Ashanti Region" — store raw region for API matching
      const rawRegion = suggestion.region || suggestion.name.replace(/\s*Region$/i, '')
      setLocation(rawRegion)
      setIsPersonalizing(true)
      navigate(`/tours?place=${encodeURIComponent(suggestion.name)}`)
      return
    }

    // Fallback: text search
    addSearch({ slug: suggestion.name, title: suggestion.name, type: 'destination' })
    setIsPersonalizing(true)
    navigate(`/tours?place=${encodeURIComponent(suggestion.name)}`)
  }, [navigate, addSearch, setLocation, setActiveValue])

  const navigateToRestaurantSuggestion = useCallback((item: RestaurantSuggestion) => {
    setShowDropdown(false)
    setRestaurantValue('')
    setHighlightedIndex(-1)
    setIsFocused(false)
    inputRef.current?.blur()

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
  }, [navigate])

  const navigateToRecent = useCallback((item: RecentSearch) => {
    setShowDropdown(false)
    setActiveValue('')
    setHighlightedIndex(-1)
    setIsFocused(false)
    inputRef.current?.blur()
    // Personalize the homepage exactly like the live suggestion does. Entries
    // carry the region; ones saved before that only have the tour's city.
    const region = item.region || item.city
    if (region) setLocation(region)
    if (item.type === 'destination') {
      setIsPersonalizing(true)
      navigate(`/tours?place=${encodeURIComponent(item.title)}`)
    } else if (item.type === 'tour' && item.slug) {
      navigate(tourPath(item.id, item.slug))
    }
  }, [navigate, setLocation, setActiveValue])

  const navigateToSearchPage = useCallback(() => {
    setShowDropdown(false)
    setHighlightedIndex(-1)
    const q = activeValue.trim()
    if (!q) return
    if (isRestaurants) {
      navigate(`/restaurants?q=${encodeURIComponent(q)}`)
      return
    }
    trackSearch(q)
    // Use the top suggestion to route to the correct page type
    if (suggestions.length > 0) {
      // Prefer place/region over attraction for Enter — user likely wants the destination, not a single site
      const top = suggestions[0]
      // Find a place/region that actually matches the query (not a random substring match)
      const matchingPlace = suggestions.find(s =>
        (s.kind === 'place' || s.kind === 'region') &&
        (s.name.toLowerCase().startsWith(q.toLowerCase()) ||
         q.toLowerCase().startsWith(s.name.toLowerCase()))
      )
      if (matchingPlace) {
        if (matchingPlace.region) setLocation(matchingPlace.region)
        navigate(`/tours?place=${encodeURIComponent(matchingPlace.name)}`)
      } else if (top.kind === 'place' || top.kind === 'region') {
        if (top.region) setLocation(top.region)
        navigate(`/tours?place=${encodeURIComponent(top.name)}`)
      } else {
        // Tour / attraction / no match — land on the All Tours page for the
        // query (a tour keyword becomes a text search there; a place becomes
        // place-scoped). Selecting a tour from the dropdown still opens the
        // tour page — this is only the Enter / Search-button path.
        const regionName = top.region || ''
        if (regionName) setLocation(regionName)
        navigate(`/tours?place=${encodeURIComponent(q)}`)
      }
    } else {
      navigate(`/tours?place=${encodeURIComponent(q)}`)
    }
  }, [activeValue, isRestaurants, navigate, setLocation, suggestions])

  useEffect(() => {
    if (suggestions.length > 0 && activeValue.trim().length >= 2) {
      window.setTimeout(() => setShowDropdown(true), 0)
      window.setTimeout(() => setHighlightedIndex(-1), 0)
    } else if (!isSearching && activeValue.trim().length >= 2) {
      // No suggestions — still show dropdown for "no matches" state
      window.setTimeout(() => setShowDropdown(true), 0)
      window.setTimeout(() => setHighlightedIndex(-1), 0)
    } else {
      window.setTimeout(() => setShowDropdown(false), 0)
      window.setTimeout(() => setHighlightedIndex(-1), 0)
    }
  }, [suggestions, activeValue, isSearching])

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const insideContainer = containerRef.current?.contains(e.target as Node)
      const insideDropdown = dropdownRef.current?.contains(e.target as Node)
      if (!insideContainer && !insideDropdown) {
        setShowDropdown(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const dropdownOpen = isRestaurants
    ? isFocused && activeValue.trim().length >= 2
    : (isFocused && recentSearches.length > 0) ||
      (showDropdown && (suggestions.length > 0 || activeValue.trim().length >= 2)) ||
      (isSearching && isFocused)

  const showSkeleton = isRestaurants
    ? isSearching && restaurantSuggestions.length === 0 && activeValue.trim().length >= 2
    : isSearching && isFocused && suggestions.length === 0 && activeValue.trim().length < 2

  useEffect(() => {
    if (!dropdownOpen) return
    const onScroll = () => {
      if (window.scrollY > 8) {
        setShowDropdown(false)
      }
    }
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [dropdownOpen])

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setActiveValue(e.target.value)
    // Typing starts a fresh interaction, so drop the "handing off to the results
    // page" flag. This used to be reset from an effect watching isSearching,
    // which set state synchronously during an effect and cascaded a render.
    if (isPersonalizing) setIsPersonalizing(false)
  }

  const handleItemMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    suppressBlurRef.current = true
  }, [])

  const handleKeyDown = (e: React.KeyboardEvent) => {
    const itemCount = isRestaurants ? restaurantSuggestions.length : suggestions.length
    if (!dropdownOpen) {
      if (e.key === 'ArrowDown' && itemCount > 0) {
        e.preventDefault()
        setShowDropdown(true)
        setHighlightedIndex(0)
      }
      return
    }

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault()
        setHighlightedIndex(prev => (prev < itemCount - 1 ? prev + 1 : 0))
        break
      case 'ArrowUp':
        e.preventDefault()
        setHighlightedIndex(prev => (prev > 0 ? prev - 1 : itemCount - 1))
        break
      case 'Enter':
        e.preventDefault()
        if (highlightedIndex >= 0 && highlightedIndex < itemCount) {
          if (isRestaurants) navigateToRestaurantSuggestion(restaurantSuggestions[highlightedIndex])
          else navigateToSuggestion(suggestions[highlightedIndex])
        } else {
          navigateToSearchPage()
        }
        break
      case 'Tab':
        if (highlightedIndex >= 0 && highlightedIndex < itemCount) {
          e.preventDefault()
          if (isRestaurants) navigateToRestaurantSuggestion(restaurantSuggestions[highlightedIndex])
          else navigateToSuggestion(suggestions[highlightedIndex])
        } else {
          setShowDropdown(false)
        }
        break
      case 'Escape':
        e.preventDefault()
        setShowDropdown(false)
        setHighlightedIndex(-1)
        inputRef.current?.blur()
        break
    }
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    // The Search button ALWAYS runs the search — it must never open a suggestion.
    // It used to fall through to the highlighted row, and because the hover
    // handler fed the same index the arrow keys use, a mouse crossing the
    // dropdown made the button open whichever tour it passed over. Suggestions
    // now open only on an explicit click (or via Tab).
    navigateToSearchPage()
  }

  const hasQuery = activeValue.trim().length >= 2

  return (
    <div className={`hero-search-wrap${isSearching ? ' searching' : ''}`} ref={containerRef}>
      <form className="hero-search-form" onSubmit={handleSubmit}>
        <div id="hero-search-bar" className={`hero-search-bar${isFocused ? ' focused' : ''}`} ref={barRef}>
          <div className="hero-search-input-wrap">
            {isSearching || isPersonalizing ? (
              <span className="search-loading-spinner" aria-hidden="true" />
            ) : (
              <MapPin className="hero-search-icon" size={24} aria-hidden="true" />
            )}
            <div className="hero-search-input-inner">
              <label className="hero-search-label" htmlFor="hero-search-input">
                {isRestaurants
                  ? t('hero.restaurantDestinationLabel', { defaultValue: 'Where do you want to eat?' })
                  : t('hero.destinationLabel', { defaultValue: 'Where do you want to go?' })}
              </label>
              <input
                ref={inputRef}
                id="hero-search-input"
                type="text"
                className="hero-search-input"
                placeholder={isRestaurants
                  ? 'Search cities, neighbourhoods or cuisines'
                  : isPersonalizing
                    ? `${t('hero.search')}...`
                    : t('hero.destinationPlaceholder')}
                autoComplete="off"
                role={isRestaurants ? 'combobox' : undefined}
                aria-label={isRestaurants ? 'Search restaurants by name or place' : undefined}
                aria-expanded={isRestaurants ? dropdownOpen : undefined}
                aria-autocomplete="list"
                aria-controls="search-dropdown"
                value={activeValue}
                onChange={handleInputChange}
                onKeyDown={handleKeyDown}
                onFocus={() => {
                  setIsFocused(true)
                  if (suggestions.length > 0 && activeValue.trim().length >= 2) {
                    setShowDropdown(true)
                  }
                }}
                onBlur={() => {
                  if (suppressBlurRef.current) {
                    suppressBlurRef.current = false
                    return
                  }
                  setTimeout(() => setIsFocused(false), 150)
                }}
              />
            </div>
          </div>
          <div className="hero-search-btn-wrap">
            <button type="submit" className="hero-search-submit">
              <Search size={18} className="hero-search-submit-icon" aria-hidden="true" />
              <span>{isRestaurants ? 'Find a table' : t('hero.search')}</span>
            </button>
          </div>
        </div>

        <MotionConfig reducedMotion="user">
          <AnimatePresence initial={false}>
            {dropdownOpen && (
              <motion.div
                className="search-dropdown"
                id="search-dropdown"
                ref={dropdownRef}
                variants={dropdownVariants}
                initial="hidden"
                animate="show"
                exit="exit"
                role="listbox"
              >
                {showSkeleton ? (
                  <div className="search-skeleton" aria-hidden="true">
                    {[0, 1, 2].map((i) => (
                      <div className="search-skeleton-row" key={i}>
                        <div className="search-skeleton-icon" />
                        <div className="search-skeleton-lines">
                          <div className="search-skeleton-line search-skeleton-line-title" />
                          <div className="search-skeleton-line search-skeleton-line-sub" />
                        </div>
                      </div>
                    ))}
                  </div>
                ) : isRestaurants ? (
                  <>
                    {restaurantSuggestions.length > 0 && (
                      <div className="search-smart-header">
                        <strong>Best matches</strong>
                        <span>Matching &ldquo;{activeValue.trim()}&rdquo;</span>
                      </div>
                    )}

                    {restaurantSuggestions.map((item, idx) => (
                      <motion.div
                        key={item.id}
                        initial={{ opacity: 0, y: 6 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.18, ease: 'easeOut', delay: Math.min(idx * 0.03, 0.45) }}
                      >
                        <div
                          className={`search-suggestion${item.kind === 'restaurant' ? ' suggestion--tour' : ' suggestion--place'}${idx === highlightedIndex ? ' highlighted' : ''}`}
                          role="option"
                          aria-selected={idx === highlightedIndex}
                          onMouseDown={(e) => {
                            handleItemMouseDown(e)
                            navigateToRestaurantSuggestion(item)
                          }}
                        >
                          {item.kind === 'restaurant' && item.image ? (
                            <div className="search-suggestion-thumb">
                              <OptimizedImage
                                src={item.image}
                                alt=""
                                width={42}
                                height={42}
                                fit="fill"
                                gravity="auto"
                                sizes="42px"
                                loading="eager"
                              />
                            </div>
                          ) : (
                            <div className="search-suggestion-icon-wrap">
                              <span className="search-suggestion-icon">
                                {item.kind === 'restaurant'
                                  ? <UtensilsCrossed size={18} aria-hidden="true" />
                                  : <MapPin size={18} aria-hidden="true" />}
                              </span>
                            </div>
                          )}
                          <div className="search-suggestion-text">
                            <span className="search-suggestion-title">{item.name}</span>
                            {item.subtitle && <span className="search-suggestion-sub">{item.subtitle}</span>}
                            {item.meta && <span className="search-suggestion-meta">{item.meta}</span>}
                          </div>
                          <span className="search-suggestion-badge">{item.badge}</span>
                        </div>
                      </motion.div>
                    ))}

                    {restaurantSuggestions.length === 0 && !isSearching && hasQuery && (
                      <div className="search-suggestion-empty">
                        <b>No matching restaurant or place found</b>
                        Try another Ghana city, neighbourhood or cuisine.
                      </div>
                    )}

                    {restaurantSuggestions.length > 0 && (
                      <div className="search-smart-footer">
                        <span>{restaurants.length} restaurants · {places.length} places</span>
                        <span>Ghana restaurant directory</span>
                      </div>
                    )}
                  </>
                ) : (
                  <>
                    {/* Recent searches — only when idle (no query typed) */}
                    {isFocused && !hasQuery && recentSearches.length > 0 && (
                      <>
                        <div className="search-recent-panel">
                          <div className="search-recent-heading">{t('search.recentSearches')}</div>
                          {recentSearches.map((item) => (
                            <div
                              key={item.slug}
                              className="search-recent-item"
                              onMouseDown={(e) => {
                                handleItemMouseDown(e)
                                navigateToRecent(item)
                              }}
                            >
                              <div className="search-recent-clock">◷</div>
                              <div className="search-recent-text">
                                <span className="search-recent-title">{item.title}</span>
                                <span className="search-recent-sub">{item.type === 'destination' ? t('search.destination') : t('search.tour')}</span>
                              </div>
                              <button
                                type="button"
                                className="search-recent-remove"
                                onMouseDown={(e) => {
                                  e.preventDefault()
                                  e.stopPropagation()
                                  removeSearch(item.slug)
                                }}
                                aria-label={t('search.removeRecent')}
                              >
                                ×
                              </button>
                            </div>
                          ))}
                          <div className="search-recent-clear" onMouseDown={(e) => { e.preventDefault(); clearAll() }}>
                            {t('search.clearRecent')}
                          </div>
                        </div>
                        {showDropdown && suggestions.length > 0 && <div className="search-recent-divider" />}
                      </>
                    )}

                    {/* Best matches header */}
                    {showDropdown && suggestions.length > 0 && (
                      <div className="search-smart-header">
                        <strong>Best matches</strong>
                        <span>Matching &ldquo;{activeValue.trim()}&rdquo;</span>
                      </div>
                    )}

                    {/* Suggestion items */}
                    {showDropdown && suggestions.length > 0 && (
                      <>
                        {suggestions.map((suggestion, idx) => {
                          const isHighlighted = idx === highlightedIndex
                          return (
                            <motion.div
                              key={suggestion.id}
                              initial={{ opacity: 0, y: 6 }}
                              animate={{ opacity: 1, y: 0 }}
                              transition={{ duration: 0.18, ease: 'easeOut', delay: Math.min(idx * 0.03, 0.45) }}
                            >
                              <div
                                className={`search-suggestion${suggestionKindClass(suggestion.kind)}${isHighlighted ? ' highlighted' : ''}`}
                                role="option"
                                aria-selected={isHighlighted}
                                onMouseDown={(e) => {
                                  handleItemMouseDown(e)
                                  navigateToSuggestion(suggestion)
                                }}
                              >
                                {suggestion.kind === 'tour' && suggestion.image ? (
                                  <div className="search-suggestion-thumb">
                                    {/* The payload's photo is full size; transform it to
                                        the 42px thumbnail box instead of downloading the
                                        whole original (up to ~370KB) per suggestion. */}
                                    <OptimizedImage
                                      src={suggestion.image}
                                      alt=""
                                      width={42}
                                      height={42}
                                      fit="fill"
                                      gravity="auto"
                                      sizes="42px"
                                      loading="eager"
                                    />
                                  </div>
                                ) : (
                                  <div className="search-suggestion-icon-wrap">
                                    <span className="search-suggestion-icon">
                                      <SearchSuggestionIcon kind={suggestion.kind} />
                                    </span>
                                  </div>
                                )}
                                <div className="search-suggestion-text">
                                  <span className="search-suggestion-title">{suggestion.name}</span>
                                  {suggestion.subtitle && (
                                    <span className="search-suggestion-sub">{suggestion.subtitle}</span>
                                  )}
                                  {suggestion.meta && (
                                    <span className="search-suggestion-meta">{suggestion.meta}</span>
                                  )}
                                </div>
                                <span className="search-suggestion-badge">{suggestion.badge}</span>
                              </div>
                            </motion.div>
                          )
                        })}
                      </>
                    )}

                    {/* No matches state */}
                    {showDropdown && suggestions.length === 0 && !isSearching && hasQuery && (
                      <div className="search-suggestion-empty">
                        <b>No matching place or attraction found</b>
                        Try another Ghana city, town, region or attraction name.
                      </div>
                    )}

                    {/* Stats footer */}
                    {showDropdown && suggestions.length > 0 && (
                      <div className="search-smart-footer">
                        <span>{stats.places} destinations · {stats.attractions} attractions · {stats.tours} tours · {stats.regions} regions</span>
                        <span>Ghana search database</span>
                      </div>
                    )}
                  </>
                )}
                </motion.div>
              )}
            </AnimatePresence>
        </MotionConfig>
      </form>
    </div>
  )
}
