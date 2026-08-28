import { useState, useEffect, lazy, Suspense } from 'react'
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
import Footer from './components/Footer'
import MountOnView from './components/MountOnView'
import { WishlistProvider } from './context/WishlistContext'
import { ContinuePlanningProvider } from './context/ContinuePlanningContext'
import { SellOutProvider } from './context/SellOutContext'
import { ChatProvider } from './chat/ChatContext'
import SupportChatWidget from './components/SupportChatWidget'
import { subscribeToAuthState, handleGoogleCallback, getAuthReturnTo, clearAuthReturnTo } from './lib/auth'
import { trackPageView, requestLocation } from './lib/analytics'
import { useHomepage } from './hooks/useHomepageSections'

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

const sectionFallback = <div style={{ minHeight: 400 }} />

function HomePage() {
  const { data: homepage, isLoading } = useHomepage()

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

  return (
    <SellOutProvider tours={homepage?.sellOut ?? []}>
      <Hero />
      <ContinuePlanningSection />
      <MoodSection preloaded={homepage?.mood} isLoading={isLoading} />
      <RecommendSection preloaded={homepage?.recommended} isLoading={isLoading} />
      <PopularLocations preloaded={homepage?.destinations} />
      <MountOnView><Suspense fallback={sectionFallback}><TopRatedSection preloaded={homepage?.topRated} isLoading={isLoading} /></Suspense></MountOnView>
      <MountOnView><Suspense fallback={sectionFallback}><SellOutSection preloaded={homepage?.sellOut} isLoading={isLoading} /></Suspense></MountOnView>
      <MountOnView><Suspense fallback={sectionFallback}><LastMinuteDealsSection preloaded={homepage?.offers} isLoading={isLoading} /></Suspense></MountOnView>
      <MountOnView><Suspense fallback={sectionFallback}><NewExperiencesSection isLoading={isLoading} /></Suspense></MountOnView>
      <MountOnView><Suspense fallback={sectionFallback}><TopAttractionsNearbySection preloaded={homepage?.attractions} /></Suspense></MountOnView>
      <MountOnView><CustomReviewsSection /></MountOnView>
      <MountOnView><Suspense fallback={sectionFallback}><TravelStoriesSection /></Suspense></MountOnView>
      <MountOnView><NewsletterSection /></MountOnView>
      <MountOnView><PartnersSection /></MountOnView>
      <MountOnView><WhyBookSection /></MountOnView>
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

  const hideNav = currentPage === 'signin' || currentPage === 'signup' || location.pathname.startsWith('/dashboard') || location.pathname.startsWith('/booking') || location.pathname.endsWith('/booking') || location.pathname.startsWith('/supplier/register') || location.pathname.startsWith('/supplier/list-experience') || location.pathname.startsWith('/login')

  return (
    <>
      <Toaster position="top-center" duration={2500} closeButton />
      {!hideNav && <Navbar onOpenAuth={handleOpenAuth} />}
      {!location.pathname.startsWith('/tour') && <SupportChatWidget onOpenAuth={handleOpenAuth} />}
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
            <AppContent />
          </ChatProvider>
        </ContinuePlanningProvider>
      </WishlistProvider>
    </BrowserRouter>
  )
}

export default App
