import { useState, useRef, useEffect, useLayoutEffect, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { AnimatePresence, MotionConfig, motion, type Variants } from 'framer-motion'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { MapPin, X } from 'lucide-react'
import { useSearchAutocomplete, type SearchSuggestion } from '../hooks/useSearchAutocomplete'
import { useRecentSearches } from '../hooks/useRecentSearches'
import { useLocationSearch } from '../context/LocationSearchContext'
import { trackSearch } from '../lib/analytics'
import './SearchBar.css'
import OptimizedImage from '@/components/shared/OptimizedImage'

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

export default function SearchBar() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { setLocation } = useLocationSearch()
  const [inputValue, setInputValue] = useState('')
  const [showDropdown, setShowDropdown] = useState(false)
  const [highlightedIndex, setHighlightedIndex] = useState(-1)
  const [isFocused, setIsFocused] = useState(false)
  const [isPersonalizing, setIsPersonalizing] = useState(false)
  const { suggestions, isSearching } = useSearchAutocomplete(inputValue)
  const { recentSearches, addSearch, removeSearch, clearAll } = useRecentSearches()
  const containerRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const barRef = useRef<HTMLDivElement>(null)
  const dropdownRef = useRef<HTMLDivElement>(null)
  // Tracks whether a mousedown just happened on a suggestion/recent item,
  // so the blur handler knows not to close the dropdown prematurely.
  const suppressBlurRef = useRef(false)

  const navigateToSuggestion = useCallback((suggestion: SearchSuggestion) => {
    if (suggestion.type === 'tour' && suggestion.slug) {
      addSearch({ slug: suggestion.slug, title: suggestion.title, type: 'tour', image: suggestion.image, city: suggestion.city })
    }
    setShowDropdown(false)
    setInputValue('')
    setHighlightedIndex(-1)
    // Blur the input so the dropdown fully closes. Without this the just-added
    // recent search keeps it open (isFocused stays true), forcing a 2nd click.
    setIsFocused(false)
    inputRef.current?.blur()
    if (suggestion.type === 'destination' || suggestion.type === 'attraction') {
      addSearch({ slug: suggestion.title, title: suggestion.title, type: 'destination' })
      setIsPersonalizing(true)
      setLocation(suggestion.title)
      navigate(`/tours?place=${encodeURIComponent(suggestion.title)}`)
    } else if (suggestion.type === 'tour' && suggestion.slug) {
      // Selecting a tour from the search bar personalizes the homepage to its
      // city, so returning to the homepage filters to that city.
      if (suggestion.city) setLocation(suggestion.city)
      navigate(`/tour/${suggestion.slug}`)
    }
  }, [navigate, addSearch, setLocation])

  const navigateToRecent = useCallback((item: { slug: string; title: string; type: 'destination' | 'tour'; image?: string; city?: string }) => {
    setShowDropdown(false)
    setInputValue('')
    setHighlightedIndex(-1)
    setIsFocused(false)
    inputRef.current?.blur()
    if (item.type === 'destination') {
      setIsPersonalizing(true)
      setLocation(item.title)
      navigate(`/tours?place=${encodeURIComponent(item.title)}`)
    } else if (item.type === 'tour' && item.slug) {
      if (item.city) setLocation(item.city)
      navigate(`/tour/${item.slug}`)
    }
  }, [navigate, setLocation])

  const navigateToSearchPage = useCallback(() => {
    setShowDropdown(false)
    setHighlightedIndex(-1)

    const q = inputValue.trim()
    if (!q) return

    trackSearch(q)
    navigate(`/search?q=${encodeURIComponent(q)}`)
  }, [inputValue, navigate])

  useEffect(() => {
    if (suggestions.length > 0 && inputValue.trim().length >= 2) {
      window.setTimeout(() => setShowDropdown(true), 0)
      window.setTimeout(() => setHighlightedIndex(-1), 0)
    } else {
      window.setTimeout(() => setShowDropdown(false), 0)
      window.setTimeout(() => setHighlightedIndex(-1), 0)
    }
  }, [suggestions, inputValue])

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

  // Clear personalizing indicator once city data arrives
  useEffect(() => {
    if (isPersonalizing && !isSearching) {
      setIsPersonalizing(false)
    }
  }, [isPersonalizing, isSearching])

  const dropdownOpen =
    (isFocused && recentSearches.length > 0) ||
    (showDropdown && suggestions.length > 0) ||
    (isSearching && isFocused)

  const showSkeleton = isSearching && isFocused && suggestions.length === 0

  useLayoutEffect(() => {
    if (!dropdownOpen) return
    const measure = () => {
      const el = dropdownRef.current
      const bar = barRef.current
      if (!el || !bar) return
      const rect = bar.getBoundingClientRect()
      el.style.top = `${rect.bottom + 6}px`
      el.style.left = `${rect.left}px`
      el.style.width = `${rect.width}px`
      el.style.visibility = 'visible'
    }
    measure()
    window.addEventListener('resize', measure)
    const onScroll = () => {
      if (window.scrollY > 8) {
        setShowDropdown(false)
      } else {
        measure()
      }
    }
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => {
      window.removeEventListener('resize', measure)
      window.removeEventListener('scroll', onScroll)
    }
  }, [dropdownOpen])

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInputValue(e.target.value)
  }

  /** Shared mousedown handler for dropdown items (suggestions + recent).
   *  Calls e.preventDefault() to stop the input from losing focus, which
   *  prevents the blur handler from racing with the click. */
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
    if (highlightedIndex >= 0 && highlightedIndex < suggestions.length) {
      navigateToSuggestion(suggestions[highlightedIndex])
    } else {
      navigateToSearchPage()
    }
  }

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
                  // If a mousedown just happened on a dropdown item, suppress
                  // the blur — the item's onClick/onMouseDown will handle it.
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
          {createPortal(
            <AnimatePresence initial={false}>
              {dropdownOpen && (
                <motion.div
                  className="search-dropdown"
                  ref={dropdownRef}
                  variants={dropdownVariants}
                  initial="hidden"
                  animate="show"
                  exit="exit"
                  style={{
                    position: 'fixed',
                    top: 0,
                    left: 0,
                    width: 0,
                    visibility: 'hidden',
                    zIndex: 1000,
                  }}
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
                    {isFocused && recentSearches.length > 0 && (
              <>
                <div className="search-dropdown-section">{t('search.recentSearches')}</div>
                {recentSearches.map((item) => (
                  <div
                    key={item.slug}
                    className="search-recent-item"
                    onMouseDown={(e) => {
                      handleItemMouseDown(e)
                      navigateToRecent(item)
                    }}
                  >
                    {item.type === 'tour' && item.image ? (
                      <div className="search-suggestion-img">
                        <OptimizedImage src={item.image} alt="" width={100} />
                      </div>
                    ) : (
                      <div className="search-suggestion-icon">
                        <MapPin size={16} />
                      </div>
                    )}
                    <div className="search-suggestion-text">
                      <span className="search-suggestion-title">{item.title}</span>
                      <span className="search-suggestion-sub">{item.type === 'destination' ? t('search.destination') : t('search.tour')}</span>
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
                      <X size={14} />
                    </button>
                  </div>
                ))}
                <div className="search-recent-clear" onMouseDown={(e) => { e.preventDefault(); clearAll() }}>
                  {t('search.clearRecent')}
                </div>
                {showDropdown && suggestions.length > 0 && <div className="search-recent-divider" />}
              </>
            )}
            {showDropdown && suggestions.length > 0 && (
              <>
                {suggestions.map((suggestion, idx) => {
                  const isHighlighted = idx === highlightedIndex
                  const isPlace = suggestion.type !== 'tour'
                  const showPlaceHeader = isPlace && (idx === 0 || suggestions[idx - 1]?.type === 'tour')
                  const showTourHeader = suggestion.type === 'tour' && (idx === 0 || suggestions[idx - 1]?.type !== 'tour')

                  return (
                    <motion.div
                      key={suggestion.id}
                      initial={{ opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.18, ease: 'easeOut', delay: Math.min(idx * 0.03, 0.45) }}
                    >
                      {showPlaceHeader && (
                        <div className="search-dropdown-section">{t('search.placesToSee')}</div>
                      )}
                      {showTourHeader && (
                          <div className="search-dropdown-section">{t('search.toursAndExperiences')}</div>
                      )}
                      <div
                        className={`search-suggestion${isHighlighted ? ' highlighted' : ''}`}
                        onMouseDown={(e) => {
                          handleItemMouseDown(e)
                          navigateToSuggestion(suggestion)
                        }}
                        onMouseEnter={() => setHighlightedIndex(idx)}
                      >
                        {suggestion.type === 'tour' ? (
                          <>
                            <div className="search-suggestion-img">
                              <OptimizedImage src={suggestion.image} alt="" width={100} />
                            </div>
                            <div className="search-suggestion-text">
                              <span className="search-suggestion-title">{suggestion.title}</span>
                              <span className="search-suggestion-sub">{suggestion.subtitle}</span>
                            </div>
                            <span className="search-suggestion-price">{suggestion.price}</span>
                          </>
                        ) : (
                          <>
                            {suggestion.image ? (
                              <div className="search-suggestion-img">
                                <OptimizedImage src={suggestion.image} alt="" width={100} />
                              </div>
                            ) : (
                              <div className="search-suggestion-icon">
                                <MapPin size={16} />
                              </div>
                            )}
                            <div className="search-suggestion-text">
                              <span className="search-suggestion-title">{suggestion.title}</span>
                              <span className="search-suggestion-sub">{suggestion.subtitle}</span>
                            </div>
                          </>
                        )}
                      </div>
                    </motion.div>
                  )
                })}
              </>
            )}
              </>
            )}
                </motion.div>
              )}
            </AnimatePresence>,
            document.body,
          )}
        </MotionConfig>
      </form>
    </div>
  )
}
