import { useState, useEffect, useRef, useCallback } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { AnimatePresence, motion, type Variants } from 'framer-motion'
import { toast } from 'sonner'
import { Clock, X, Globe, Megaphone, ChevronRight } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import i18n from '../i18n/config'
import { useCurrency } from '../contexts/CurrencyContext'
import logoSrc from '../assets/expo_trans.png'
import userSrc from '../assets/icons/User Circle.png'
import { subscribeToAuthState, signOutUser, getStoredAuthUser, type AuthUser } from '../lib/auth'
import { getSupplierPortalUrl } from '../lib/supplier'
import { useSupplierStatus } from '../hooks/useSupplierStatus'
import { useMyBookingsCount } from '../hooks/useExpeditionBookings'
import { useSearchAutocomplete, type SearchSuggestion } from '../hooks/useSearchAutocomplete'
import { useRecentSearches } from '../hooks/useRecentSearches'
import LanguageCurrencyModal from './LanguageCurrencyModal'
import './Navbar.css'
import OptimizedImage from '@/components/shared/OptimizedImage'

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

interface NavbarProps {
  onOpenAuth?: (mode: 'signin' | 'signup') => void
}

export default function Navbar({ onOpenAuth }: NavbarProps) {
  const navigate = useNavigate()
  const location = useLocation()
  const isTourDetailPage = location.pathname.startsWith('/tour')
  const [user, setUser] = useState<AuthUser | null>(getStoredAuthUser)
  const [searchBarSticky, setSearchBarSticky] = useState(false)
  const [dropdownOpen, setDropdownOpen] = useState(false)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [signingOut, setSigningOut] = useState(false)
  const [langCurrencyOpen, setLangCurrencyOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)
  const { t } = useTranslation()
  const { currency } = useCurrency()
  const [navSearchValue, setNavSearchValue] = useState('')
  const [showNavDropdown, setShowNavDropdown] = useState(false)
  const [navHighlightedIndex, setNavHighlightedIndex] = useState(-1)
  const [navIsFocused, setNavIsFocused] = useState(false)
  const navSearchRef = useRef<HTMLDivElement>(null)
  const navInputRef = useRef<HTMLInputElement>(null)
  const { suggestions: navSuggestions, isSearching: navIsSearching } = useSearchAutocomplete(navSearchValue)
  const { recentSearches, addSearch, removeSearch, clearAll } = useRecentSearches()
  const { isApproved } = useSupplierStatus()
  // Counter of the user's confirmed bookings shown on the "Bookings" menu item.
  const { data: bookingsCount = 0 } = useMyBookingsCount('CONFIRMED,PENDING', !!user)

  useEffect(() => {
    const unsub = subscribeToAuthState((u) => setUser(u))
    return () => { unsub.then((fn) => fn()) }
  }, [])

  useEffect(() => {
    const handleScroll = () => {
      const heroSearch = document.getElementById('hero-search-bar')
      if (!heroSearch) return

      if (window.scrollY < 10) {
        document.body.classList.remove('hero--search-sticky')
        setSearchBarSticky(false)
        return
      }
      const rect = heroSearch.getBoundingClientRect()
      if (rect.height === 0) return
      const navbarEl = document.querySelector('.navbar')
      const navbarHeight = navbarEl ? navbarEl.clientHeight : 64
      const sticky = rect.top <= navbarHeight + 4
      document.body.classList.toggle('hero--search-sticky', sticky)
      setSearchBarSticky(sticky)
    }

    window.addEventListener('scroll', handleScroll, { passive: true })
    handleScroll()

    return () => {
      window.removeEventListener('scroll', handleScroll)
      document.body.classList.remove('hero--search-sticky')
    }
  }, [])

  const navigateToSuggestion = useCallback((suggestion: SearchSuggestion) => {
    if (suggestion.type === 'tour' && suggestion.slug) {
      addSearch({ slug: suggestion.slug, title: suggestion.title, type: 'tour' })
    }
    setShowNavDropdown(false)
    setNavSearchValue('')
    setNavHighlightedIndex(-1)
    if (suggestion.type === 'tour' && suggestion.slug) {
      navigate(`/tour/${suggestion.slug}`)
    }
  }, [navigate, addSearch])

  const navigateToRecent = useCallback((item: { slug: string; title: string; type: 'destination' | 'tour' }) => {
    setShowNavDropdown(false)
    setNavSearchValue('')
    setNavHighlightedIndex(-1)
    setNavIsFocused(false)
    navInputRef.current?.blur()
    if (item.type === 'tour' && item.slug) {
      navigate(`/tour/${item.slug}`)
    }
  }, [navigate])

  const navigateToSearchPage = useCallback(() => {
    setShowNavDropdown(false)
    setNavHighlightedIndex(-1)
    const q = navSearchValue.trim()
    if (!q) return
    navigate(`/search?q=${encodeURIComponent(q)}`)
  }, [navSearchValue, navigate])

  const handleListExperience = useCallback(async () => {
    if (!user) {
      // Signed-out visitors land on the public "become a supplier" page first
      // (how it works + FAQ) instead of being dropped straight into sign-in.
      navigate('/supplier/list-experience')
      return
    }
    // Already-approved suppliers go straight to the Travio Ghana-Supplier
    // platform to log in securely; everyone else continues the application.
    const portalUrl = await getSupplierPortalUrl()
    if (portalUrl) {
      window.location.href = portalUrl
      return
    }
    navigate('/supplier/register')
  }, [user, navigate])

  // Mobile "List an Experience": close the drawer so its AnimatePresence exit
  // transition plays out smoothly in this tab, then open the supplier page in
  // a brand-new browser tab. window.open runs inside the tap gesture so popup
  // blockers don't swallow it.
  const handleMobileListExperience = useCallback(() => {
    const path = user ? '/supplier/register' : '/supplier/list-experience'
    window.open(path, '_blank', 'noopener')
    setMobileMenuOpen(false)
  }, [user])

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
    } else {
      window.setTimeout(() => setShowNavDropdown(false), 0)
      window.setTimeout(() => setNavHighlightedIndex(-1), 0)
    }
  }, [navSuggestions, navSearchValue])

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
    ...(user ? [{ label: t('nav.bookings'), key: 'Bookings' as const, icon: 'bag' as const }] : []),
    ...(user ? [{ label: t('nav.dashboard'), key: 'Dashboard' as const, icon: 'grid' as const }] : []),
    { label: t('nav.about'), key: 'About' as const, icon: 'info' as const },
    { label: t('nav.contact'), key: 'Contact' as const, icon: 'mail' as const },
  ]

  const navDropdownOpen =
    (navIsFocused && recentSearches.length > 0) ||
    (showNavDropdown && navSuggestions.length > 0) ||
    (navIsSearching && navIsFocused)

  const navShowSkeleton = navIsSearching && navIsFocused && navSuggestions.length === 0

  return (
    <>
    <nav className={`navbar${searchBarSticky ? ' scrolled' : ''}${isTourDetailPage ? ' navbar--tour-detail' : ''}`}>
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
            if (navHighlightedIndex >= 0 && navHighlightedIndex < navSuggestions.length) {
              navigateToSuggestion(navSuggestions[navHighlightedIndex])
            } else {
              navigateToSearchPage()
            }
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
                    {navIsFocused && recentSearches.length > 0 && (
                <>
                  <div className="search-dropdown-section">{t('search.recentSearches')}</div>
                  {recentSearches.map((item) => (
                    <div
                      key={item.slug}
                      className="search-recent-item"
                      onMouseDown={(e) => {
                        e.preventDefault()
                        navigateToRecent(item)
                      }}
                    >
                      <div className="search-suggestion-icon">
                        <Clock size={16} />
                      </div>
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
                  {showNavDropdown && navSuggestions.length > 0 && <div className="search-recent-divider" />}
                </>
              )}
              {showNavDropdown && navSuggestions.length > 0 && (
                <>
                  {navSuggestions.map((suggestion, idx) => {
                    const isHighlighted = idx === navHighlightedIndex
                    const showDestHeader = suggestion.type === 'destination' && (idx === 0 || navSuggestions[idx - 1]?.type !== 'destination')
                    const showTourHeader = suggestion.type === 'tour' && (idx === 0 || navSuggestions[idx - 1]?.type !== 'tour')

                    return (
                      <motion.div
                        key={suggestion.id}
                        initial={{ opacity: 0, y: 6 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.18, ease: 'easeOut', delay: Math.min(idx * 0.03, 0.45) }}
                      >
                        {showDestHeader && (
                          <div className="search-dropdown-section">{t('common.destinations')}</div>
                        )}
                        {showTourHeader && (
                          <div className="search-dropdown-section">{t('search.toursAndExperiences')}</div>
                        )}
                        <div
                          className={`search-suggestion${isHighlighted ? ' highlighted' : ''}`}
                          onMouseDown={(e) => {
                            e.preventDefault()
                            navigateToSuggestion(suggestion)
                          }}
                          onMouseEnter={() => setNavHighlightedIndex(idx)}
                        >
                          {suggestion.type === 'destination' ? (
                            <>
                              <div className="search-suggestion-icon">
                                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                  <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
                                  <circle cx="12" cy="10" r="3" />
                                </svg>
                              </div>
                              <div className="search-suggestion-text">
                                <span className="search-suggestion-title">{suggestion.title}</span>
                                <span className="search-suggestion-sub">{suggestion.subtitle}</span>
                              </div>
                            </>
                          ) : (
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
          </AnimatePresence>
        </div>
      </div>

      <div className="nav-right">
        <a href="#" className="nav-list-experience" onClick={(e) => { e.preventDefault(); e.stopPropagation(); handleListExperience() }}>
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
          <a href="#" className="nav-icon-item" onClick={(e) => { e.preventDefault(); e.stopPropagation(); navigate('/dashboard/wishlist') }}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
            </svg>
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
                      onClick={(e) => {
                        e.preventDefault()
                        e.stopPropagation()
                        setDropdownOpen(false)
                        if (link.key === 'Dashboard') {
                          navigate('/dashboard')
                        }
                        if (link.key === 'Bookings') {
                          navigate('/dashboard/bookings')
                        }
                      }}
                    >
                      {link.icon === 'bag' && (
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z" />
                          <line x1="3" y1="6" x2="21" y2="6" />
                          <path d="M16 10a4 4 0 0 1-8 0" />
                        </svg>
                      )}
                      {link.icon === 'grid' && (
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <rect x="3" y="3" width="7" height="7" />
                          <rect x="14" y="3" width="7" height="7" />
                          <rect x="14" y="14" width="7" height="7" />
                          <rect x="3" y="14" width="7" height="7" />
                        </svg>
                      )}
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
                      {link.label}
                      {link.key === 'Bookings' && bookingsCount > 0 && (
                        <span className="nav-dropdown-badge">{bookingsCount}</span>
                      )}
                    </a>
                  ))}

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
        <a href="#" className="nav-wishlist-mobile" onClick={(e) => { e.preventDefault(); e.stopPropagation(); navigate('/dashboard/wishlist') }} aria-label={t('nav.wishlist')}>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
          </svg>
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
            <a href="#" className="nav-mobile-list-experience" onClick={(e) => { e.preventDefault(); e.stopPropagation(); handleMobileListExperience() }}>
              <span className="nav-mobile-list-experience-icon">
                <Megaphone size={19} strokeWidth={2} />
              </span>
              <span className="nav-mobile-list-experience-text">
                <span className="nav-mobile-list-experience-title">{isApproved ? t('nav.supplierDashboard') : t('nav.listAnExperience', 'List an Experience')}</span>
                <span className="nav-mobile-list-experience-sub">{isApproved ? t('nav.supplierDashboardSub') : t('nav.listAnExperienceSub', 'Become a supplier and start earning')}</span>
              </span>
              <ChevronRight size={18} className="nav-mobile-list-experience-chevron" />
            </a>
            {user ? (
              <div className="nav-mobile-user">
                <img src={user.photoURL || userSrc} alt="" className="nav-mobile-user-avatar" onError={(e) => { (e.target as HTMLImageElement).src = userSrc }} />
                <div className="nav-mobile-user-info">
                  <span className="nav-mobile-user-name">{user.name}</span>
                  <span className="nav-mobile-user-email">{user.email}</span>
                </div>
              </div>
            ) : (
              <a href="#" className="nav-mobile-link">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="8" r="4" />
                  <path d="M20 21a8 8 0 1 0-16 0" />
                </svg>
                {t('nav.profile')}
              </a>
            )}
            <div className="nav-mobile-link" onClick={() => { setMobileMenuOpen(false); setLangCurrencyOpen(true) }}>
              <Globe size={18} />
              <span>Language &amp; Currency</span>
            </div>
            <div className="nav-mobile-divider" />
            {user && (
              <a href="#" className="nav-mobile-link" onClick={(e) => { e.preventDefault(); e.stopPropagation(); setMobileMenuOpen(false); navigate('/dashboard/bookings') }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z" />
                  <line x1="3" y1="6" x2="21" y2="6" />
                  <path d="M16 10a4 4 0 0 1-8 0" />
                </svg>
                {t('nav.bookings')}
                {bookingsCount > 0 && <span className="nav-mobile-badge">{bookingsCount}</span>}
              </a>
            )}
            {user && (
              <a href="#" className="nav-mobile-link" onClick={(e) => { e.preventDefault(); e.stopPropagation(); setMobileMenuOpen(false); navigate('/dashboard') }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="3" width="7" height="7" />
                  <rect x="14" y="3" width="7" height="7" />
                  <rect x="14" y="14" width="7" height="7" />
                  <rect x="3" y="14" width="7" height="7" />
                </svg>
                {t('nav.dashboard')}
              </a>
            )}

            <a href="#" className="nav-mobile-link" onClick={(e) => { e.preventDefault(); e.stopPropagation(); setMobileMenuOpen(false); }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="16" x2="12" y2="12" />
                <line x1="12" y1="8" x2="12.01" y2="8" />
              </svg>
              {t('nav.about')}
            </a>
            <a href="#" className="nav-mobile-link" onClick={(e) => { e.preventDefault(); e.stopPropagation(); setMobileMenuOpen(false); }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
                <polyline points="22,6 12,13 2,6" />
              </svg>
              {t('nav.contact')}
            </a>
            <div className="nav-mobile-divider" />
            {user ? (
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
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                    <polyline points="16 17 21 12 16 7" />
                    <line x1="21" y1="12" x2="9" y2="12" />
                  </svg>
                  {t('nav.signOut')}
                </div>
              )
            ) : (
              <div className="nav-mobile-sign" onClick={() => { setMobileMenuOpen(false); onOpenAuth?.('signup') }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="8" r="4" />
                  <path d="M20 21a8 8 0 1 0-16 0" />
                </svg>
                {t('nav.signInSignUp')}
              </div>
            )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {langCurrencyOpen && <LanguageCurrencyModal onClose={() => setLangCurrencyOpen(false)} />}
      </AnimatePresence>
    </>
  )
}
