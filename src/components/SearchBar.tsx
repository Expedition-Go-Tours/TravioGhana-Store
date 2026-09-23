import { useState, useRef, useEffect, useCallback } from 'react'
import { AnimatePresence, MotionConfig, motion, type Variants } from 'framer-motion'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useSearchAutocomplete, type SearchSuggestion } from '../hooks/useSearchAutocomplete'
import { useRecentSearches, type RecentSearch } from '../hooks/useRecentSearches'
import { useLocationSearch } from '../context/LocationSearchContext'
import { useSearchInput } from '../context/SearchInputContext'
import { trackSearch } from '../lib/analytics'
import SearchSuggestionIcon from './shared/SearchSuggestionIcon'
import './SearchBar.css'

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

export default function SearchBar() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { setLocation } = useLocationSearch()
  const { searchValue: inputValue, setSearchValue: setInputValue } = useSearchInput()
  const [showDropdown, setShowDropdown] = useState(false)
  const [highlightedIndex, setHighlightedIndex] = useState(-1)
  const [isFocused, setIsFocused] = useState(false)
  const [isPersonalizing, setIsPersonalizing] = useState(false)
  const { suggestions, isSearching, stats } = useSearchAutocomplete(inputValue)
  const { recentSearches, addSearch, removeSearch, clearAll } = useRecentSearches()
  const containerRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const barRef = useRef<HTMLDivElement>(null)
  const dropdownRef = useRef<HTMLDivElement>(null)
  const suppressBlurRef = useRef(false)

  const navigateToSuggestion = useCallback((suggestion: SearchSuggestion) => {
    setShowDropdown(false)
    setInputValue('')
    setHighlightedIndex(-1)
    setIsFocused(false)
    inputRef.current?.blur()

    // Tour: go to product page, set region for homepage personalization
    if (suggestion.kind === 'tour' && suggestion.slug) {
      addSearch({ slug: suggestion.slug, title: suggestion.name, type: 'tour', image: suggestion.image, city: suggestion.city, region: suggestion.region })
      if (suggestion.region) setLocation(suggestion.region)
      navigate(`/tour/${suggestion.slug}`)
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
  }, [navigate, addSearch, setLocation, setInputValue])

  const navigateToRecent = useCallback((item: RecentSearch) => {
    setShowDropdown(false)
    setInputValue('')
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
      navigate(`/tour/${item.slug}`)
    }
  }, [navigate, setLocation, setInputValue])

  const navigateToSearchPage = useCallback(() => {
    setShowDropdown(false)
    setHighlightedIndex(-1)
    const q = inputValue.trim()
    if (!q) return
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
  }, [inputValue, navigate, setLocation, suggestions])

  useEffect(() => {
    if (suggestions.length > 0 && inputValue.trim().length >= 2) {
      window.setTimeout(() => setShowDropdown(true), 0)
      window.setTimeout(() => setHighlightedIndex(-1), 0)
    } else if (!isSearching && inputValue.trim().length >= 2) {
      // No suggestions — still show dropdown for "no matches" state
      window.setTimeout(() => setShowDropdown(true), 0)
      window.setTimeout(() => setHighlightedIndex(-1), 0)
    } else {
      window.setTimeout(() => setShowDropdown(false), 0)
      window.setTimeout(() => setHighlightedIndex(-1), 0)
    }
  }, [suggestions, inputValue, isSearching])

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

  const dropdownOpen =
    (isFocused && recentSearches.length > 0) ||
    (showDropdown && (suggestions.length > 0 || inputValue.trim().length >= 2)) ||
    (isSearching && isFocused)

  const showSkeleton = isSearching && isFocused && suggestions.length === 0 && inputValue.trim().length < 2

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
    setInputValue(e.target.value)
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
    if (!showDropdown) {
      if (e.key === 'ArrowDown' && suggestions.length > 0) {
        e.preventDefault()
        setShowDropdown(true)
        setHighlightedIndex(0)
      }
      return
    }

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault()
        setHighlightedIndex(prev =>
          prev < suggestions.length - 1 ? prev + 1 : 0
        )
        break
      case 'ArrowUp':
        e.preventDefault()
        setHighlightedIndex(prev =>
          prev > 0 ? prev - 1 : suggestions.length - 1
        )
        break
      case 'Enter':
        e.preventDefault()
        if (highlightedIndex >= 0 && highlightedIndex < suggestions.length) {
          navigateToSuggestion(suggestions[highlightedIndex])
        } else {
          navigateToSearchPage()
        }
        break
      case 'Tab':
        if (highlightedIndex >= 0 && highlightedIndex < suggestions.length) {
          e.preventDefault()
          navigateToSuggestion(suggestions[highlightedIndex])
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

  const hasQuery = inputValue.trim().length >= 2

  return (
    <div className={`hero-search-wrap${isSearching ? ' searching' : ''}`} ref={containerRef}>
      <form className="hero-search-form" onSubmit={handleSubmit}>
        <div id="hero-search-bar" className={`hero-search-bar${isFocused ? ' focused' : ''}`} ref={barRef}>
          <div className="hero-search-input-wrap">
            {isSearching || isPersonalizing ? (
              <span className="search-loading-spinner" aria-hidden="true" />
            ) : (
              <svg className="hero-search-icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="11" cy="11" r="8" />
                <line x1="21" y1="21" x2="16.65" y2="16.65" />
              </svg>
            )}
            <div className="hero-search-input-inner">
              <input
                ref={inputRef}
                type="text"
                className="hero-search-input"
                placeholder={isPersonalizing ? `${t('hero.search')}...` : t('hero.destinationPlaceholder')}
                autoComplete="off"
                aria-autocomplete="list"
                aria-controls="search-dropdown"
                value={inputValue}
                onChange={handleInputChange}
                onKeyDown={handleKeyDown}
                onFocus={() => {
                  setIsFocused(true)
                  if (suggestions.length > 0 && inputValue.trim().length >= 2) {
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
            <button type="submit" className="hero-search-submit">{t('hero.search')}</button>
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
                        <span>Matching &ldquo;{inputValue.trim()}&rdquo;</span>
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
                                    <img src={suggestion.image} alt="" loading="lazy" />
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
