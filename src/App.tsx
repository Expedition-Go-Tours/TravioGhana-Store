import { useState, useEffect, useMemo, lazy, Suspense } from 'react'
import { BrowserRouter, Routes, Route, useNavigate, useLocation } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { Toaster } from 'sonner'
import Navbar from './components/Navbar'
import Hero from './components/Hero'
import ContinuePlanningSection from './components/ContinuePlanningSection'
import MoodSection from './components/MoodSection'
import RecommendSection from './components/RecommendSection'
import PopularLocations from './components/PopularLocations'
import CustomReviewsSection from './components/CustomReviewsSection'
import PartnersSection from './components/PartnersSection'
import WhyBookSection from './components/WhyBookSection'
import NewsletterSection from './components/NewsletterSection'
import LocationSearchSkeleton from './components/LocationSearchSkeleton'
import HomeSectionSkeleton from './components/HomeSectionSkeleton'
import HistorySections from './components/HistorySections'
import PreviousSearchSections from './components/PreviousSearchSections'
import Footer from './components/Footer'
import MountOnView from './components/MountOnView'
import { WishlistProvider } from './context/WishlistContext'
import { ContinuePlanningProvider } from './context/ContinuePlanningContext'
import { SellOutProvider } from './context/SellOutContext'
import { LocationSearchProvider, useLocationSearch } from './context/LocationSearchContext'
import { ChatProvider } from './chat/ChatContext'
import SupportChatWidget from './components/SupportChatWidget'
import { subscribeToAuthState, handleGoogleCallback, getAuthReturnTo, clearAuthReturnTo } from './lib/auth'
import { trackPageView, requestLocation } from './lib/analytics'
import { useHomepage, useHomepageByCity } from './hooks/useHomepageSections'

// Route-level code splitting
const AuthForm = lazy(() => import('./pages/AuthForm'))
const DashboardLayout = lazy(() => import('./pages/dashboard/DashboardLayout'))
const TourDetailPage = lazy(() => import('./pages/tour-detail/TourDetailPage'))
const AllToursPage = lazy(() => import('./pages/AllToursPage'))
const SearchResultsPage = lazy(() => import('./pages/SearchResultsPage'))
const AllStoriesPage = lazy(() => import('./pages/AllStoriesPage'))
const StoryDetailPage = lazy(() => import('./pages/StoryDetailPage'))
const ReviewExperiencePage = lazy(() => import('./pages/ReviewExperiencePage'))
const SupplierPage = lazy(() => import('./pages/SupplierPage'))
const SupplierRegisterPage = lazy(() => import('./pages/supplier/SupplierRegisterPage'))
const SupplierLandingPage = lazy(() => import('./pages/supplier/SupplierLandingPage'))
const BookingPage = lazy(() => import('./pages/BookingPage'))
const BookingConfirmationPage = lazy(() => import('./pages/BookingConfirmationPage'))

// Below-fold homepage sections (lazy loaded, mounted on scroll)
const TopRatedSection = lazy(() => import('./components/TopRatedSection'))
const SellOutSection = lazy(() => import('./components/SellOutSection'))
const LastMinuteDealsSection = lazy(() => import('./components/LastMinuteDealsSection'))
const NewExperiencesSection = lazy(() => import('./components/NewExperiencesSection'))
const TopAttractionsNearbySection = lazy(() => import('./components/TopAttractionsNearbySection'))
const TravelStoriesSection = lazy(() => import('./components/TravelStoriesSection'))


type PageView = 'home' | 'signin' | 'signup'

function HomePage() {
  const { currentLocation, previousLocations, hasActiveSearch } = useLocationSearch()
  const { data: homepage, isLoading } = useHomepage({ enabled: !hasActiveSearch })
  const { data: cityHomepage, isLoading: isCityLoading, isError: isCityError } = useHomepageByCity(currentLocation)

  // Use city-scoped data when a location search is active, fall back to global on error
  const data = hasActiveSearch && !isCityError ? (cityHomepage ?? homepage) : homepage
  const loading = hasActiveSearch ? isCityLoading : isLoading

  // Prefetch below-fold section chunks during browser idle time.
  // This ensures chunks are cached before the user scrolls, without
  // competing with LCP/FCP rendering on the critical path.
  useEffect(() => {
    const prefetch = () => {
      import('./components/TopRatedSection')
      import('./components/SellOutSection')
      import('./components/LastMinuteDealsSection')
      import('./components/NewExperiencesSection')
      import('./components/TopAttractionsNearbySection')
      import('./components/TravelStoriesSection')
    }
    if ('requestIdleCallback' in window) {
      (window as any).requestIdleCallback(prefetch, { timeout: 3000 })
    } else {
      setTimeout(prefetch, 1000)
    }
  }, [])

  // Memoize the title formatter to avoid re-renders in section components
  // (must be above any conditional returns — Rules of Hooks)
  const locationTitle = useMemo(() => {
    if (!hasActiveSearch || !currentLocation) return undefined
    return (section: string) => `${section} in ${currentLocation}`
  }, [hasActiveSearch, currentLocation])
  const locationFilter = hasActiveSearch ? currentLocation ?? undefined : undefined

  // While a location search is loading, keep the real hero visible (instant
  // paint) and show the prototype's "Finding the best experiences in {loc}…"
  // loader with shimmer rows underneath.
  if (hasActiveSearch && isCityLoading) {
    return (
      <SellOutProvider tours={[]}>
        <Hero />
        <LocationSearchSkeleton location={currentLocation} />
        <Footer />
      </SellOutProvider>
    )
  }

  return (
    <SellOutProvider tours={data?.sellOut ?? []}>
      <Hero />
      <ContinuePlanningSection />
      {/* Show history when no active search and user has previous locations */}
      {!hasActiveSearch && previousLocations.length > 0 && <HistorySections />}
      {/* Categories: "What do you want to do?" on the generic homepage,
          "Based on your search in {city}" when personalized. */}
      <MoodSection
        preloaded={data?.mood}
        isLoading={loading}
        title={locationTitle?.('Based on your search')}
      />
      <RecommendSection
        preloaded={data?.recommended}
        isLoading={loading}
        title={locationTitle?.('Recommended')}
        location={locationFilter}
      />
      {/* PopularLocations: hidden when personalized per spec */}
      {!hasActiveSearch && <PopularLocations preloaded={data?.destinations} />}
      <Suspense fallback={<HomeSectionSkeleton />}><TopRatedSection preloaded={data?.topRated} isLoading={loading} title={locationTitle?.('Top Rated')} location={locationFilter} /></Suspense>
      <Suspense fallback={<HomeSectionSkeleton />}><SellOutSection preloaded={data?.sellOut} isLoading={loading} title={locationTitle?.('Likely To Sell Out')} location={locationFilter} /></Suspense>
      <Suspense fallback={<HomeSectionSkeleton />}><LastMinuteDealsSection preloaded={data?.offers} isLoading={loading} title={locationTitle?.('Special Offers')} location={locationFilter} /></Suspense>
      <Suspense fallback={<HomeSectionSkeleton />}><NewExperiencesSection isLoading={loading} title={locationTitle?.('New Experiences')} location={locationFilter} /></Suspense>
      <Suspense fallback={<HomeSectionSkeleton />}><TopAttractionsNearbySection preloaded={data?.attractions} title={locationTitle?.('Top Attractions Nearby')} location={locationFilter} /></Suspense>
      <MountOnView><CustomReviewsSection location={locationFilter} /></MountOnView>
      <MountOnView><PreviousSearchSections /></MountOnView>
      <MountOnView><Suspense fallback={<HomeSectionSkeleton />}><TravelStoriesSection /></Suspense></MountOnView>
      <MountOnView><NewsletterSection /></MountOnView>
      {/* Trust block only on the generic homepage (matches the prototype) */}
      {!hasActiveSearch && <MountOnView><PartnersSection /></MountOnView>}
      {!hasActiveSearch && <MountOnView><WhyBookSection /></MountOnView>}
      <Footer />
    </SellOutProvider>
  )
}

function AppContent() {
  const [currentPage, setCurrentPage] = useState<PageView>('home')
  const navigate = useNavigate()

  useEffect(() => {
    const unsub = subscribeToAuthState(() => {})
    return () => { unsub.then((fn) => fn()) }   
  }, [])

  useEffect(() => {
    // Processes the Google OAuth callback (a full page-load back from Google
    // with ?accessToken=...&refreshToken=...) and then honors any pending
    // return-to. Mount-only: react-router's useNavigate() returns a new
    // function whenever the pathname changes, so listing it in the deps would
    // re-run this on every navigation and consume the pending return-to.
    (async () => {
      const processed = await handleGoogleCallback()
      const returnTo = processed ? getAuthReturnTo() : null
      if (returnTo) {
        clearAuthReturnTo()
        navigate(returnTo)
      }
    })()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handleOpenAuth = (mode: 'signin' | 'signup') => {
    navigate('/')
    setCurrentPage(mode)
  }
  const handleGoHome = () => setCurrentPage('home')
  const location = useLocation()

  // Land at the top of the page on every route change (e.g. clicking a supplier
  // link deep in a tour page shouldn't drop you mid-way down the next page).
  useEffect(() => {
    if ('scrollRestoration' in window.history) {
      window.history.scrollRestoration = 'manual'
    }
  }, [])
  useEffect(() => {
    window.scrollTo(0, 0)
    trackPageView(location.pathname + location.search)
  }, [location.pathname, location.search])

  // Request location once on mount for personalized recommendations
  useEffect(() => {
    requestLocation()
  }, [])

  const hideNav = currentPage === 'signin' || currentPage === 'signup' || location.pathname.startsWith('/dashboard') || location.pathname.startsWith('/booking') || location.pathname.endsWith('/booking') || location.pathname.startsWith('/supplier/register') || location.pathname.startsWith('/supplier/list-experience') || location.pathname.startsWith('/login') || location.pathname.startsWith('/auth/callback')

  // The auth form only lives on "/" (currentPage) or the /login route; if a
  // return-to redirect takes the user elsewhere while auth is still "open",
  // reset it so the navbar/auth view don't stay stuck in auth mode.
  // Render-phase adjustment (same pattern as the chat provider), guarded so it
  // only fires when currentPage actually changes.
  const [prevPage, setPrevPage] = useState<PageView>(currentPage)
  if (currentPage !== prevPage) {
    setPrevPage(currentPage)
    if ((currentPage === 'signin' || currentPage === 'signup') && location.pathname !== '/') {
      setCurrentPage('home')
    }
  }

  // The chat widget disappears while the auth page is shown (kept mounted so
  // it reopens where the user left off after signing in).
  const authVisible = currentPage === 'signin' || currentPage === 'signup' || location.pathname.startsWith('/login') || location.pathname.startsWith('/auth/callback')

  return (
    <>
      <Toaster position="top-center" duration={2500} closeButton />
      {!hideNav && <Navbar onOpenAuth={handleOpenAuth} />}
      {!location.pathname.startsWith('/tour') && <SupportChatWidget onOpenAuth={handleOpenAuth} hidden={authVisible} />}
      <Suspense fallback={<div style={{ minHeight: '60vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><div className="spinner" /></div>}>
      <Routes>
        <Route path="/dashboard/*" element={<DashboardLayout />} />
        <Route path="/tour/:tourId" element={
          <TourDetailPage onOpenAuth={handleOpenAuth} />
        } />
        <Route path="/tours" element={
          <AllToursPage onOpenAuth={handleOpenAuth} />
        } />
        <Route path="/search" element={
          <SearchResultsPage />
        } />
        <Route path="/review/:tourTitle" element={
          <ReviewExperiencePage />
        } />
        <Route path="/supplier/:supplierName" element={
          <SupplierPage />
        } />
        <Route path="/supplier/register" element={
          <SupplierRegisterPage onOpenAuth={handleOpenAuth} />
        } />
        <Route path="/supplier/list-experience" element={
          <SupplierLandingPage onOpenAuth={handleOpenAuth} />
        } />
        <Route path="/booking" element={
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.25, ease: 'easeOut' }}
          >
            <BookingPage />
          </motion.div>
        } />
        <Route path="/:tourId/booking" element={
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.25, ease: 'easeOut' }}
          >
            <BookingPage />
          </motion.div>
        } />
        <Route path="/booking/confirmation/:bookingId" element={
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.25, ease: 'easeOut' }}
          >
            <BookingConfirmationPage />
          </motion.div>
        } />
        <Route path="/booking/confirmation" element={
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.25, ease: 'easeOut' }}
          >
            <BookingConfirmationPage />
          </motion.div>
        } />
        <Route path="/login" element={
          <AuthForm
            initialMode="signin"
            onBack={() => navigate('/')}
            onAuthSuccess={() => navigate('/')}
          />
        } />
        <Route path="/auth/callback" element={
          <div style={{ minHeight: '60vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <div className="spinner" />
          </div>
        } />
        <Route path="/stories" element={<AllStoriesPage />} />
        <Route path="/stories/:slug" element={<StoryDetailPage />} />
        <Route path="/*" element={
          <AnimatePresence mode="wait">
            {currentPage === 'signin' || currentPage === 'signup' ? (
              <motion.div
                key="auth"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                transition={{ duration: 0.25, ease: 'easeInOut' }}
              >
                <AuthForm
                  initialMode={currentPage}
                  onBack={handleGoHome}
                  onAuthSuccess={handleGoHome}
                />
              </motion.div>
            ) : (
              <motion.div
                key="home"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.25, ease: 'easeInOut' }}
              >
                <HomePage />
              </motion.div>
            )}
          </AnimatePresence>
        } />
      </Routes>
      </Suspense>
    </>
  )
}

function App() {
  return (
    <BrowserRouter>
      <WishlistProvider>
        <ContinuePlanningProvider>
          <ChatProvider>
            <LocationSearchProvider>
              <AppContent />
            </LocationSearchProvider>
          </ChatProvider>
        </ContinuePlanningProvider>
      </WishlistProvider>
    </BrowserRouter>
  )
}

export default App
