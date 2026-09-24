import { useState, useEffect, useRef, useCallback } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { tourPath } from '../lib/tourPath'
import { AnimatePresence, motion, type Variants } from 'framer-motion'
import { toast } from 'sonner'
import { Globe, Megaphone, ChevronRight, LogIn, LogOut, DollarSign, Bell, Settings } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import i18n from '../i18n/config'
import { useCurrency } from '../contexts/CurrencyContext'
import logoSrc from '../assets/TravioGhana_Logo.svg'
import userSrc from '../assets/icons/User Circle.png'
import { subscribeToAuthState, signOutUser, getStoredAuthUser, type AuthUser } from '../lib/auth'
import { readBookingsSeen, writeBookingsSeen } from '../lib/bookingsBadge'
import { shouldIdlePrefetch } from '../lib/perfProfile'
import { prefetchSupportPages } from '../lib/prefetchSupport'
import { useSupplierStatus } from '../hooks/useSupplierStatus'
import { getSupplierPortalUrl } from '../lib/supplier'
import { useMyBookingsCount } from '../hooks/useExpeditionBookings'
import { useWishlist } from '../context/WishlistContext'
import { useLocationSearch } from '../context/LocationSearchContext'
import { useContinuePlanning } from '../context/ContinuePlanningContext'
import { useSearchInput } from '../context/SearchInputContext'
import { useSearchAutocomplete, type SearchSuggestion } from '../hooks/useSearchAutocomplete'
import { useRecentSearches, type RecentSearch } from '../hooks/useRecentSearches'
import BookingsIcon from './shared/BookingsIcon'
import SearchSuggestionIcon from './shared/SearchSuggestionIcon'
import LanguageCurrencyModal from './LanguageCurrencyModal'
import MobileSubDrawer, { type SubDrawerTab } from './MobileSubDrawer'
import './Navbar.css'

const navDropdownVariants: Variants = {
  hidden: { opacity: 0, y: -6, scale: 0.985 },
  show: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: { duration: 0.18, ease: 'easeOut' },
  },
  exit: {
    opacity: 0,
    y: -6,
    scale: 0.985,
    transition: { duration: 0.15, ease: 'easeIn' },
  },
}

/* BookingsIcon now lives in components/shared/BookingsIcon.tsx (imported above)
   so the search-dropdown suggestion icons can reuse it. */

interface NavbarProps {
  onOpenAuth?: (mode: 'signin' | 'signup') => void
}

export default function Navbar({ onOpenAuth }: NavbarProps) {
  const navigate = useNavigate()
  const location = useLocation()
  const isTourDetailPage = location.pathname.startsWith('/tour')
  const [user, setUser] = useState<AuthUser | null>(getStoredAuthUser)
  const [searchBarSticky, setSearchBarSticky] = useState(false)
  // The tinted "over the hero" navbar is only for the homepage at the very top
  // of the page. Every other route renders a solid white navbar from the first
  // frame, instead of starting translucent/green-tinted and flipping to white
  // once the route's content (e.g. a footer page) mounts.
  const isOverHero = location.pathname === '/' && !searchBarSticky
  const [dropdownOpen, setDropdownOpen] = useState(false)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [subDrawerTab, setSubDrawerTab] = useState<SubDrawerTab | null>(null)
  // Reset the sub-drawer whenever the mobile menu closes (render-phase state
  // adjustment — the linter-approved way to sync state to a prop change).
  const [prevMenuOpen, setPrevMenuOpen] = useState(mobileMenuOpen)
  if (!mobileMenuOpen && prevMenuOpen) {
    setPrevMenuOpen(false)
    setSubDrawerTab(null)
  }
  if (mobileMenuOpen && !prevMenuOpen) {
    setPrevMenuOpen(true)
  }
  const [signingOut, setSigningOut] = useState(false)
  const [langCurrencyOpen, setLangCurrencyOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)
  const { t } = useTranslation()
  const { currency } = useCurrency()
  const { wishlistCount } = useWishlist()
  const { searchValue: navSearchValue, setSearchValue: setNavSearchValue } = useSearchInput()
  const [showNavDropdown, setShowNavDropdown] = useState(false)
  const [navHighlightedIndex, setNavHighlightedIndex] = useState(-1)
  const [navIsFocused, setNavIsFocused] = useState(false)
  const navSearchRef = useRef<HTMLDivElement>(null)
  const navInputRef = useRef<HTMLInputElement>(null)
  const { suggestions: navSuggestions, isSearching: navIsSearching } = useSearchAutocomplete(navSearchValue)
  const { recentSearches, addSearch, removeSearch, clearAll } = useRecentSearches()
  const { hasActiveSearch, setLocation, resetLocation } = useLocationSearch()
  const { clearContinuePlanning } = useContinuePlanning()
  const { profile: supplierProfile, isApproved } = useSupplierStatus()
  // Counter of the user's confirmed bookings shown on the "Bookings" menu item.
  const { data: bookingsCount = 0 } = useMyBookingsCount('CONFIRMED,PENDING', !!user)
  // Bookings counter is dismissed once the user taps the Bookings item — it
  // only comes back when the count grows beyond what was last seen.
  const [bookingsSeen, setBookingsSeen] = useState(() => readBookingsSeen())
  const showBookingsBadge = bookingsCount > 0 && bookingsCount > bookingsSeen
  const markBookingsSeen = useCallback(() => {
    setBookingsSeen(bookingsCount)
    writeBookingsSeen(bookingsCount)
  }, [bookingsCount])

  useEffect(() => {
    const unsub = subscribeToAuthState((u) => setUser(u))
    return () => { unsub.then((fn) => fn()) }
  }, [])

  // Drop-shadow only once the page is actually scrolling, on every route —
  // the navbar rests flat against the page like it does over the homepage hero.
  // State only flips on the threshold crossing, so scrolling never re-renders.
  const [elevated, setElevated] = useState(false)
  const elevatedRef = useRef(false)
  useEffect(() => {
    const handleElevatedScroll = () => {
      const next = window.scrollY > 4
      if (next === elevatedRef.current) return
      elevatedRef.current = next
      setElevated(next)
    }
    window.addEventListener('scroll', handleElevatedScroll, { passive: true })
    handleElevatedScroll()
    return () => window.removeEventListener('scroll', handleElevatedScroll)
  }, [])

  // Updates the sticky-search state synchronously on scroll — deliberately not
  // rAF-throttled, because iOS Safari pauses rAF during momentum scrolling
  // (the bar would only stick after the user stops). Layout thrash is avoided
  // instead by writing to the DOM only when the boolean actually flips.
  const lastStickyRef = useRef(false)
  useEffect(() => {
    let heroSearch: HTMLElement | null = null
    let navbarHeight = 64

    const handleNavScroll = () => {
      if (!heroSearch || !heroSearch.isConnected) {
        heroSearch = document.getElementById('hero-search-bar')
        const navbarEl = document.querySelector('.navbar')
        navbarHeight = navbarEl ? (navbarEl as HTMLElement).clientHeight : 64
      }
      if (!heroSearch) {
        // Left the homepage while sticky — clear the body class so other pages
        // don't render the compact search.
        if (lastStickyRef.current) {
          lastStickyRef.current = false
          document.body.classList.remove('hero--search-sticky')
          setSearchBarSticky(false)
        }
        return
      }

      if (window.scrollY < 10) {
        if (lastStickyRef.current) {
          lastStickyRef.current = false
          document.body.classList.remove('hero--search-sticky')
          setSearchBarSticky(false)
        }
        return
      }
      const rect = heroSearch.getBoundingClientRect()
      if (rect.height === 0) return
      const sticky = rect.top <= navbarHeight + 4
      if (sticky === lastStickyRef.current) return
      lastStickyRef.current = sticky
      document.body.classList.toggle('hero--search-sticky', sticky)
      setSearchBarSticky(sticky)
    }

    window.addEventListener('scroll', handleNavScroll, { passive: true })
    window.addEventListener('resize', handleNavScroll)
    handleNavScroll()

    return () => {
      window.removeEventListener('scroll', handleNavScroll)
      window.removeEventListener('resize', handleNavScroll)
      document.body.classList.remove('hero--search-sticky')
    }
  }, [])

  const navigateToSuggestion = useCallback((suggestion: SearchSuggestion) => {
    if (suggestion.kind === 'tour' && suggestion.slug) {
      addSearch({ id: suggestion.tourId, slug: suggestion.slug, title: suggestion.name, type: 'tour', image: suggestion.image, city: suggestion.city })
    }
    setShowNavDropdown(false)
    setNavSearchValue('')
    setNavHighlightedIndex(-1)
    setNavIsFocused(false)
    navInputRef.current?.blur()
    if (suggestion.kind === 'place') {
      addSearch({ slug: suggestion.name, title: suggestion.name, type: 'destination', region: suggestion.region })
      if (suggestion.region) setLocation(suggestion.region)
      // Land on the place-scoped All Tours page wherever we are. This used to
      // send anyone who was not already on '/' back to the homepage instead of
      // searching, so picking a destination from the navbar did nothing.
      navigate(`/tours?place=${encodeURIComponent(suggestion.name)}`)
    } else if (suggestion.kind === 'attraction') {
      addSearch({ slug: suggestion.name, title: suggestion.name, type: 'destination', region: suggestion.region })
      if (suggestion.region) setLocation(suggestion.region)
      navigate(`/tours?attraction=${encodeURIComponent(suggestion.name)}&place=${encodeURIComponent(suggestion.region || '')}`)
    } else if (suggestion.kind === 'region') {
      addSearch({ slug: suggestion.name, title: suggestion.name, type: 'destination', region: suggestion.region })
      const rawRegion = suggestion.region || suggestion.name.replace(/\s*Region$/i, '')
      setLocation(rawRegion)
      navigate(`/tours?place=${encodeURIComponent(suggestion.name)}`)
    } else if (suggestion.kind === 'tour' && suggestion.slug) {
      addSearch({ id: suggestion.tourId, slug: suggestion.slug, title: suggestion.name, type: 'tour', image: suggestion.image, city: suggestion.city, region: suggestion.region })
      if (suggestion.region) setLocation(suggestion.region)
      navigate(tourPath(suggestion.tourId, suggestion.slug))
    }
  }, [navigate, addSearch, setLocation])

  const navigateToRecent = useCallback((item: RecentSearch) => {
    setShowNavDropdown(false)
    setNavSearchValue('')
    setNavHighlightedIndex(-1)
    setNavIsFocused(false)
    navInputRef.current?.blur()
    // Personalize the homepage exactly like the live suggestion does. Entries
    // carry the region; ones saved before that only have the tour's city.
    const region = item.region || item.city
    if (region) setLocation(region)
    if (item.type === 'destination') {
      // Land on the place-scoped All Tours page — NOT the homepage — so clicking
      // a recent search behaves exactly like searching it (the hero does the
      // same). Navigating to '/' threw the user out of the listing they were on.
      navigate(`/tours?place=${encodeURIComponent(item.title)}`)
    } else if (item.type === 'tour' && item.slug) {
      navigate(tourPath(item.id, item.slug))
    }
  }, [navigate, setLocation])

  const navigateToSearchPage = useCallback(() => {
    setShowNavDropdown(false)
    setNavHighlightedIndex(-1)
    const q = navSearchValue.trim()
    if (!q) return
    // Clear + blur before navigating: the dropdown-open effect re-opens whenever
    // a non-empty value still has suggestions, so without this the dropdown
    // stays rendered after the route change.
    setNavSearchValue('')
    setNavIsFocused(false)
    navInputRef.current?.blur()
    if (navSuggestions.length > 0) {
      const top = navSuggestions[0]
      // Find a place/region that actually matches the query (not a random substring match)
      const matchingPlace = navSuggestions.find(s =>
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
        // query (a tour keyword becomes a text search there). Selecting a tour
        // from the dropdown still opens the tour page; this is the submit path.
        const regionName = top.region || ''
        if (regionName) setLocation(regionName)
        navigate(`/tours?place=${encodeURIComponent(q)}`)
      }
    } else {
      navigate(`/tours?place=${encodeURIComponent(q)}`)
    }
  }, [navSearchValue, navigate, setLocation, navSuggestions])

  // Navbar "List an Experience" CTA (desktop).
  //
  // Approved suppliers go straight into the supplier platform via SSO;
  // everyone else (signed out, no application yet, or under review) lands on
  // the "Join as a Supplier" page, which renders either the application form
  // or the current application status.
  const handleListExperience = useCallback(async () => {
    if (isApproved) {
      const portalUrl = await getSupplierPortalUrl(supplierProfile)
      if (portalUrl) {
        window.location.assign(portalUrl)
        return
      }
    }
    // Send the CTA to the public marketing page (navbar visible, no form).
    // Applying is a deliberate second step from there: its CTAs go to
    // /supplier/register, which keeps the focused no-navbar application flow.
    navigate('/supplier/list-experience')
  }, [isApproved, supplierProfile, navigate])

  // Warm the supplier application chunk so the CTA opens instantly — fired on
  // hover/focus of the "List an Experience" links and once after first idle.
  const prefetchSupplierRoutes = useCallback(() => {
    void import('../pages/supplier/SupplierRegisterPage').catch(() => {})
  }, [])

  // Warm the dashboard chunks (Wishlist / Bookings / Reviews / Settings) so
  // opening them from the navbar is instant instead of a lazy fetch — fired on
  // hover/focus of the wishlist and bookings entry points.
  const prefetchDashboard = useCallback(() => {
    void import('../pages/dashboard/DashboardLayout').catch(() => {})
    void import('../pages/BookingHistory').catch(() => {})
    void import('../pages/Wishlist').catch(() => {})
  }, [])

  useEffect(() => {
    if (!shouldIdlePrefetch()) return
    const canIdle = 'requestIdleCallback' in window
    const id = canIdle
      ? window.requestIdleCallback(prefetchSupplierRoutes, { timeout: 3000 })
      : window.setTimeout(prefetchSupplierRoutes, 3000)
    return () => {
      if (canIdle) window.cancelIdleCallback(id)
      else window.clearTimeout(id)
    }
  }, [prefetchSupplierRoutes])

  // Mobile "List an Experience": same destination as desktop. The drawer
  // closes first so its AnimatePresence exit transition plays out smoothly.
  const handleMobileListExperience = useCallback(() => {
    setMobileMenuOpen(false)
    void handleListExperience()
  }, [handleListExperience, setMobileMenuOpen])

  // Prefetch the dashboard chunks so navigating to Bookings / Wishlist /
  // Dashboard / Updates from the drawer (or avatar menu) is instant, not a
  // lazy fetch.
  useEffect(() => {
    if (!user) return
    import('../pages/dashboard/DashboardLayout').catch(() => {})
    import('../pages/BookingHistory').catch(() => {})
    import('../pages/Wishlist').catch(() => {})
  }, [user])

  useEffect(() => {
    if (mobileMenuOpen && user) {
      import('../pages/dashboard/DashboardLayout').catch(() => {})
      import('../pages/BookingHistory').catch(() => {})
      import('../pages/Wishlist').catch(() => {})
    }
  }, [mobileMenuOpen, user])

  // Prefetch the dashboard + wishlist chunks during browser idle so the first
  // tap on the wishlist/bookings icons is instant even on touch devices
  // (which never fire the hover/focus prefetches above).
  useEffect(() => {
    if (!shouldIdlePrefetch()) return
    const prefetchDashboardIdle = () => {
      import('../pages/dashboard/DashboardLayout').catch(() => {})
      import('../pages/Wishlist').catch(() => {})
    }
    const canIdle = 'requestIdleCallback' in window
    const id = canIdle
      ? window.requestIdleCallback(prefetchDashboardIdle, { timeout: 4000 })
      : window.setTimeout(prefetchDashboardIdle, 4000)
    return () => {
      if (canIdle) window.cancelIdleCallback(id)
      else window.clearTimeout(id)
    }
  }, [])

  // "Back to menu" from the dashboard reopens the mobile drawer on arrival.
  useEffect(() => {
    const state = location.state as { openMobileMenu?: boolean } | null
    if (state?.openMobileMenu) {
      window.history.replaceState({}, '')
      // Defer to a microtask (still before paint) so the state update isn't a
      // sync setState-in-effect.
      Promise.resolve().then(() => setMobileMenuOpen(true))
    }
  }, [location.state])

  const handleNavKeyDown = (e: React.KeyboardEvent) => {
    if (!showNavDropdown) {
      if (e.key === 'ArrowDown' && navSuggestions.length > 0) {
        e.preventDefault()
        setShowNavDropdown(true)
        setNavHighlightedIndex(0)
      }
      return
    }
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault()
        setNavHighlightedIndex(prev =>
          prev < navSuggestions.length - 1 ? prev + 1 : 0
        )
        break
      case 'ArrowUp':
        e.preventDefault()
        setNavHighlightedIndex(prev =>
          prev > 0 ? prev - 1 : navSuggestions.length - 1
        )
        break
      case 'Enter':
        e.preventDefault()
        if (navHighlightedIndex >= 0 && navHighlightedIndex < navSuggestions.length) {
          navigateToSuggestion(navSuggestions[navHighlightedIndex])
        } else {
          navigateToSearchPage()
        }
        break
      case 'Tab':
        if (navHighlightedIndex >= 0 && navHighlightedIndex < navSuggestions.length) {
          e.preventDefault()
          navigateToSuggestion(navSuggestions[navHighlightedIndex])
        } else {
          setShowNavDropdown(false)
        }
        break
      case 'Escape':
        e.preventDefault()
        setShowNavDropdown(false)
        setNavHighlightedIndex(-1)
        navInputRef.current?.blur()
        break
    }
  }

  useEffect(() => {
    if (navSuggestions.length > 0 && navSearchValue.trim().length >= 2) {
      window.setTimeout(() => setShowNavDropdown(true), 0)
      window.setTimeout(() => setNavHighlightedIndex(-1), 0)
    } else if (!navIsSearching && navSearchValue.trim().length >= 2) {
      window.setTimeout(() => setShowNavDropdown(true), 0)
      window.setTimeout(() => setNavHighlightedIndex(-1), 0)
    } else {
      window.setTimeout(() => setShowNavDropdown(false), 0)
      window.setTimeout(() => setNavHighlightedIndex(-1), 0)
    }
  }, [navSuggestions, navSearchValue, navIsSearching])

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false)
      }
      if (navSearchRef.current && !navSearchRef.current.contains(e.target as Node)) {
        setShowNavDropdown(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const dropdownLinks: { label: string; key: string; icon: string }[] = [
    { label: t('nav.about'), key: 'About' as const, icon: 'info' as const },
    { label: t('nav.contact'), key: 'Contact' as const, icon: 'mail' as const },
    ...(user
      ? [{ label: t('nav.accountSettings', 'Account Settings'), key: 'AccountSettings' as const, icon: 'settings' as const }]
      : []),
  ]

  const navDropdownOpen =
    (navIsFocused && !navSearchValue.trim() && recentSearches.length > 0) ||
    (showNavDropdown && navSuggestions.length > 0) ||
    (navIsSearching && navIsFocused)

  const navShowSkeleton = navIsSearching && navIsFocused && navSuggestions.length === 0

  return (
    <>
    <nav className={`navbar${isOverHero ? ' navbar--over-hero' : ''}${searchBarSticky ? ' scrolled' : ''}${elevated ? ' navbar--elevated' : ''}${isTourDetailPage ? ' navbar--tour-detail' : ''}`}>
      <div className="nav-left">
        <div className="nav-logo">
          <a href="/" onClick={(e) => { e.preventDefault(); navigate('/') }}>
            <img src={logoSrc} alt="Travio Ghana" className="nav-logo-img" />
          </a>
        </div>
      </div>

      <div className="nav-center">
        <div className={`navbar-compact-search${navIsSearching ? ' searching' : ''}`} ref={navSearchRef}>
          <form className={`navbar-search-form${navIsFocused ? ' focused' : ''}`} onSubmit={(e) => {
            e.preventDefault()
            // Always run the search — never open the highlighted suggestion.
            // See SearchBar.handleSubmit: a hover used to set the same index the
            // arrow keys use, so the button opened whatever the mouse crossed.
            navigateToSearchPage()
          }}>
            <div className="navbar-search-inner">
              {navIsSearching ? (
                <span className="search-loading-spinner" aria-hidden="true" />
              ) : (
                <svg className="navbar-search-icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="11" cy="11" r="8" />
                  <line x1="21" y1="21" x2="16.65" y2="16.65" />
                </svg>
              )}
              <div className="navbar-search-input-inner">
                <input
                  ref={navInputRef}
                  type="text"
                  className="navbar-search-input"
                  placeholder={t('hero.destinationPlaceholder')}
                  autoComplete="off"
                  value={navSearchValue}
                  onChange={(e) => setNavSearchValue(e.target.value)}
                  onKeyDown={handleNavKeyDown}
                  onFocus={() => {
                    setNavIsFocused(true)
                    if (navSuggestions.length > 0 && navSearchValue.trim().length >= 2) {
                      setShowNavDropdown(true)
                    }
                  }}
                  onBlur={() => {
                    setTimeout(() => setNavIsFocused(false), 200)
                  }}
                />
              </div>
            </div>
            <div className="navbar-search-btn-wrap">
              <button type="submit" className="navbar-search-btn">{t('hero.search')}</button>
            </div>
          </form>

          <AnimatePresence initial={false}>
            {navDropdownOpen && (
              <motion.div
                className="navbar-search-dropdown"
                variants={navDropdownVariants}
                initial="hidden"
                animate="show"
                exit="exit"
              >
                {navShowSkeleton ? (
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
                    {navIsFocused && !navSearchValue.trim() && recentSearches.length > 0 && (
                <>
                  <div className="search-recent-panel">
                    <div className="search-recent-heading">{t('search.recentSearches')}</div>
                    {recentSearches.map((item) => (
                      <div
                        key={item.slug}
                        className="search-recent-item"
                        onMouseDown={(e) => {
                          e.preventDefault()
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
                  {showNavDropdown && navSuggestions.length > 0 && <div className="search-recent-divider" />}
                </>
              )}
              {showNavDropdown && navSuggestions.length > 0 && (
                <>
                  <div className="search-smart-header">
                    <strong>Best matches</strong>
                    <span>Matching &ldquo;{navSearchValue.trim()}&rdquo;</span>
                  </div>
                  {navSuggestions.map((suggestion, idx) => {
                    const isHighlighted = idx === navHighlightedIndex

                    return (
                      <motion.div
                        key={suggestion.id}
                        initial={{ opacity: 0, y: 6 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.18, ease: 'easeOut', delay: Math.min(idx * 0.03, 0.45) }}
                      >
                        <div
                          className={`search-suggestion suggestion--${suggestion.kind}${isHighlighted ? ' highlighted' : ''}`}
                          onMouseDown={(e) => {
                            e.preventDefault()
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
                            <span className="search-suggestion-sub">{suggestion.subtitle}</span>
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
                  </>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      <div className="nav-right">
        <a href="#" className="nav-list-experience" onClick={(e) => { e.preventDefault(); e.stopPropagation(); handleListExperience() }} onPointerEnter={prefetchSupplierRoutes} onFocus={prefetchSupplierRoutes}>
          <span className="nav-list-experience-icon">
            <Megaphone size={15} strokeWidth={2.1} />
          </span>
          <span className="nav-list-experience-label">{isApproved ? t('nav.supplierDashboard') : t('nav.listAnExperience', 'List an Experience')}</span>
        </a>

        <div className="nav-icon-item nav-globe-trigger" onClick={() => setLangCurrencyOpen(true)}>
          <Globe size={20} />
          <span className="nav-icon-label">{i18n.language.substring(0, 2).toUpperCase()} | {currency.code}</span>
        </div>

        <div className="nav-icons">
          {user && (
            <a href="#" className="nav-icon-item" onClick={(e) => { e.preventDefault(); e.stopPropagation(); markBookingsSeen(); navigate('/dashboard/bookings') }} aria-label={t('nav.bookings')} onPointerEnter={prefetchDashboard} onFocus={prefetchDashboard}>
              <span className="nav-icon-glyph">
                <BookingsIcon size={22} />
                {showBookingsBadge && <span className="nav-icon-badge">{bookingsCount}</span>}
              </span>
              <span className="nav-icon-label">{t('nav.bookings')}</span>
            </a>
          )}
          <a href="#" className="nav-icon-item" onClick={(e) => { e.preventDefault(); e.stopPropagation(); navigate('/dashboard/wishlist') }} aria-label={t('nav.wishlist')} onPointerEnter={prefetchDashboard} onFocus={prefetchDashboard}>
            <span className="nav-icon-glyph">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
              </svg>
              {wishlistCount > 0 && <span className="nav-icon-badge">{wishlistCount}</span>}
            </span>
            <span className="nav-icon-label">{t('nav.wishlist')}</span>
          </a>
          <div className="nav-icon-item" onClick={() => setDropdownOpen(!dropdownOpen)}>
            <div className="nav-avatar-wrapper" ref={dropdownRef}>
              <button className="nav-avatar-btn" onClick={(e) => { e.stopPropagation(); setDropdownOpen(!dropdownOpen) }} aria-label={t('nav.profile')}>
                <img src={user?.photoURL || userSrc} alt={t('nav.profile')} className="nav-avatar-img" onError={(e) => { (e.target as HTMLImageElement).src = userSrc }} />
              </button>
              {dropdownOpen && (
                <div className="nav-dropdown">
                  {user ? (
                    <div className="nav-dropdown-user">
                      <img
                        src={user.photoURL || userSrc}
                        alt=""
                        className="nav-dropdown-avatar"
                        onError={(e) => { (e.target as HTMLImageElement).src = userSrc }}
                      />
                      <span className="nav-dropdown-email">{user.email}</span>
                    </div>
                  ) : (
                    <div className="nav-dropdown-header" onClick={() => { setDropdownOpen(false); onOpenAuth?.('signup') }}>
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <circle cx="12" cy="8" r="4" />
                        <path d="M20 21a8 8 0 1 0-16 0" />
                      </svg>
                      {t('nav.signInSignUp')}
                    </div>
                  )}

                  {dropdownLinks.map((link) => (
                    <a
                      key={link.label}
                      href="#"
                      className="nav-dropdown-item"
                      onPointerEnter={link.key === 'Contact' ? prefetchSupportPages : undefined}
                      onFocus={link.key === 'Contact' ? prefetchSupportPages : undefined}
                      onClick={(e) => {
                        e.preventDefault()
                        e.stopPropagation()
                        setDropdownOpen(false)
                        if (link.key === 'About') {
                          navigate('/about-us')
                        }
                        if (link.key === 'Contact') {
                          navigate('/contact-us')
                        }
                        if (link.key === 'AccountSettings') {
                          navigate('/dashboard/settings')
                        }
                      }}
                    >
                      {link.icon === 'info' && (
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <circle cx="12" cy="12" r="10" />
                          <line x1="12" y1="16" x2="12" y2="12" />
                          <line x1="12" y1="8" x2="12.01" y2="8" />
                        </svg>
                      )}
                      {link.icon === 'mail' && (
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
                          <polyline points="22,6 12,13 2,6" />
                        </svg>
                      )}
                      {link.icon === 'settings' && (
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <circle cx="12" cy="12" r="3" />
                          <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
                        </svg>
                      )}
                      {link.label}
                    </a>
                  ))}

                  {hasActiveSearch && (
                    <div className="nav-dropdown-item" onClick={() => {
                      resetLocation()
                      clearContinuePlanning()
                      setDropdownOpen(false)
                      navigate('/')
                    }}>
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
                        <path d="M3 3v5h5" />
                      </svg>
                      {t('nav.resetToDefault', { defaultValue: 'Reset to default' })}
                    </div>
                  )}

                  {user && (
                    signingOut ? (
                      <div className="nav-dropdown-signingout">
                        <div className="nav-spinner-sm" />
                        {t('nav.signingOut')}
                      </div>
                    ) : (
                      <div className="nav-dropdown-signout" onClick={async (e) => {
                        e.stopPropagation()
                        setSigningOut(true)
                        await signOutUser()
                        setSigningOut(false)
                        setDropdownOpen(false)
                        toast.success(t('auth.signedOut'))
                      }}>
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                          <polyline points="16 17 21 12 16 7" />
                          <line x1="21" y1="12" x2="9" y2="12" />
                        </svg>
                        {t('nav.signOut')}
                      </div>
                    )
                  )}
                </div>
              )}
            </div>
            <span className="nav-icon-label">{user?.name || t('nav.profile')}</span>
          </div>
        </div>
        {user && (
          <a href="#" className="nav-bookings-mobile" onClick={(e) => { e.preventDefault(); e.stopPropagation(); markBookingsSeen(); navigate('/dashboard/bookings') }} aria-label={t('nav.bookings')} onPointerEnter={prefetchDashboard} onFocus={prefetchDashboard}>
            <span className="nav-icon-glyph">
              <BookingsIcon size={22} />
              {showBookingsBadge && <span className="nav-icon-badge">{bookingsCount}</span>}
            </span>
            <span className="nav-icon-label">{t('nav.bookings')}</span>
          </a>
        )}
        <a href="#" className="nav-wishlist-mobile" onClick={(e) => { e.preventDefault(); e.stopPropagation(); navigate('/dashboard/wishlist') }} aria-label={t('nav.wishlist')} onPointerEnter={prefetchDashboard} onFocus={prefetchDashboard}>
          <span className="nav-icon-glyph">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
            </svg>
            {wishlistCount > 0 && <span className="nav-icon-badge">{wishlistCount}</span>}
          </span>
          <span className="nav-icon-label">{t('nav.wishlist')}</span>
        </a>
        <button className="nav-hamburger" onClick={() => setMobileMenuOpen(!mobileMenuOpen)} aria-label="Toggle menu">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            {mobileMenuOpen ? (
              <>
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </>
            ) : (
              <>
                <line x1="3" y1="6" x2="21" y2="6" />
                <line x1="3" y1="12" x2="21" y2="12" />
                <line x1="3" y1="18" x2="21" y2="18" />
              </>
            )}
          </svg>
        </button>
      </div>
    </nav>

      <AnimatePresence>
        {mobileMenuOpen && (
          <motion.div
            className="nav-mobile-overlay"
            onClick={() => setMobileMenuOpen(false)}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
          >
            <motion.div
              className="nav-mobile-menu"
              onClick={(e) => e.stopPropagation()}
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', stiffness: 300, damping: 30 }}
            >
            <button className="nav-mobile-close" onClick={() => setMobileMenuOpen(false)} aria-label="Close menu">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>

            <h3 className="nav-mobile-heading">{t('nav.profile')}</h3>

            {user ? (
              <div className="nav-mobile-user">
                <img src={user.photoURL || userSrc} alt="" className="nav-mobile-user-avatar" onError={(e) => { (e.target as HTMLImageElement).src = userSrc }} />
                <div className="nav-mobile-user-info">
                  <span className="nav-mobile-user-name">{user.name}</span>
                  <span className="nav-mobile-user-email">{user.email}</span>
                </div>
                <button
                  className="nav-mobile-user-settings"
                  onClick={() => { setMobileMenuOpen(false); navigate('/dashboard/settings') }}
                  aria-label="Account Settings"
                >
                  <Settings size={18} />
                </button>
              </div>
            ) : (
              <div className="nav-mobile-login" onClick={() => { setMobileMenuOpen(false); onOpenAuth?.('signup') }}>
                <LogIn size={18} />
                {t('nav.loginOrSignUp', 'Login or sign up')}
              </div>
            )}

            <div className="nav-mobile-divider" />

            <div className="nav-mobile-link" onClick={() => {
              if (!user) { setMobileMenuOpen(false); onOpenAuth?.('signin'); return }
              setSubDrawerTab('updates')
            }}>
              <Bell size={18} />
              {t('nav.updates', 'Updates')}
            </div>
            <div className="nav-mobile-link" onClick={() => setSubDrawerTab('language')}>
              <Globe size={18} />
              {t('nav.language')}
            </div>
            <div className="nav-mobile-link" onClick={() => setSubDrawerTab('currency')}>
              <DollarSign size={18} />
              {t('nav.currency')}
            </div>

            <a href="#" className="nav-mobile-link" onClick={(e) => { e.preventDefault(); e.stopPropagation(); setMobileMenuOpen(false); navigate('/about-us') }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="16" x2="12" y2="12" />
                <line x1="12" y1="8" x2="12.01" y2="8" />
              </svg>
              {t('nav.about')}
            </a>
            <a href="#" className="nav-mobile-link" onPointerEnter={prefetchSupportPages} onFocus={prefetchSupportPages} onClick={(e) => { e.preventDefault(); e.stopPropagation(); setMobileMenuOpen(false); navigate('/contact-us') }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
                <polyline points="22,6 12,13 2,6" />
              </svg>
              {t('nav.contact')}
            </a>

            <a href="#" className="nav-mobile-list-experience" onClick={(e) => { e.preventDefault(); e.stopPropagation(); handleMobileListExperience() }} onPointerEnter={prefetchSupplierRoutes} onFocus={prefetchSupplierRoutes}>
              <span className="nav-mobile-list-experience-icon">
                <Megaphone size={19} strokeWidth={2} />
              </span>
              <span className="nav-mobile-list-experience-text">
                <span className="nav-mobile-list-experience-title">{isApproved ? t('nav.supplierDashboard') : t('nav.listAnExperience', 'List an Experience')}</span>
                <span className="nav-mobile-list-experience-sub">{isApproved ? t('nav.supplierDashboardSub') : t('nav.listAnExperienceSub', 'Become a supplier and start earning')}</span>
              </span>
              <ChevronRight size={18} className="nav-mobile-list-experience-chevron" />
            </a>

            <div className="nav-mobile-divider" />
            {user && (
              signingOut ? (
                <div className="nav-mobile-signingout">
                  <div className="nav-spinner-sm" />
                  {t('nav.signingOut')}
                </div>
              ) : (
                <div className="nav-mobile-signout" onClick={async () => {
                  setSigningOut(true)
                  await signOutUser()
                  setSigningOut(false)
                  setMobileMenuOpen(false)
                  toast.success(t('auth.signedOut'), {
                    position: 'top-center',
                    duration: 3000,
                  })
                }}>
                  <LogOut size={18} />
                  {t('nav.logout', 'Logout')}
                </div>
              )
            )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {langCurrencyOpen && <LanguageCurrencyModal onClose={() => setLangCurrencyOpen(false)} />}
      </AnimatePresence>

      <MobileSubDrawer
        tab={subDrawerTab}
        onClose={() => setSubDrawerTab(null)}
        onNavigate={(path) => {
          setSubDrawerTab(null)
          setMobileMenuOpen(false)
          navigate(path)
        }}
      />
    </>
  )
}
