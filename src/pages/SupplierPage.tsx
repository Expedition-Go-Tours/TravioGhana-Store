import { useState, useRef } from 'react'
import type { ReactNode } from 'react'
import { useParams, useNavigate, useLocation, Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { motion } from 'framer-motion'
import {
  ArrowLeft, ShieldCheck, Car, Star, MapPin, Clock, MessageCircle,
  ChevronLeft, ChevronRight,
} from 'lucide-react'
import { toast } from 'sonner'
import TourCard from '../components/TourCard'
import Footer from '../components/Footer'
import StarRating from '../components/StarRating'
import SEO, { buildBreadcrumbSchema } from '../components/SEO'
import SupplierPhotoStrip from '../components/supplier/SupplierPhotoStrip'
import SupplierReviewsSection from '../components/supplier/SupplierReviewsSection'
import { useCarouselRail } from '../components/supplier/useCarouselRail'
import { mapSupplierProfile, type SupplierProfileData } from '../lib/supplierProfile'
import { classifySupplierSegment } from '../lib/supplierResolution'
import { supplierTypeLabel } from '../lib/supplier'
import { useSupplierProfile, useSupplierTours } from '../hooks/useSupplierProfile'
import { useSupplierReviews, type SupplierReviewTour } from '../hooks/useExternalReviews'
import { getOrCreateConversation } from '../chat/chatApi'
import { useAuthUser } from '../hooks/useAuthUser'
import { setAuthReturnTo } from '../lib/auth'
import './SupplierPage.css'
import OptimizedImage from '@/components/shared/OptimizedImage'

/** Cards the activities rail shows before "View all activities" takes over. */
const RAIL_TOURS = 12
/** Card geometry of the homepage carousels (see RecommendSection). */
const CARD_WIDTH = 295
const CARD_GAP = 16

interface MiniDetail {
  icon: ReactNode
  label: string
  value: string
  /** "Open today" pill under the value. */
  openNow?: boolean
}

export default function SupplierPage() {
  const { supplierName } = useParams()
  const { t } = useTranslation()
  const navigate = useNavigate()
  const location = useLocation()
  const user = useAuthUser()
  const segment = supplierName ? decodeURIComponent(supplierName) : ''
  const routeIdentity = classifySupplierSegment(segment)
  const routerState = (location.state as { tourId?: string; supplierId?: string } | null) ?? {}

  const {
    data: rawTour,
    isLoading: profileLoading,
    error: profileError,
    refetch: refetchProfile,
  } = useSupplierProfile({
    tourId: routerState.tourId,
    supplierId: routeIdentity.supplierId ?? routerState.supplierId,
    name: routeIdentity.name,
  })
  const supplierData: SupplierProfileData | null = rawTour
    ? mapSupplierProfile({ tour: rawTour })
    : null
  const supplierId = supplierData?.supplierId || null
  const { data: toursResult, isLoading: toursLoading } = useSupplierTours(supplierId)
  const supplierTours = toursResult?.tours ?? []
  const totalTours = toursResult?.totalCount ?? supplierTours.length

  // A supplier id in the URL is not a name — never print a cuid as the heading.
  const profileName = supplierData?.name || routeIdentity.name || t('supplier.unknownName')
  const ratingDisplay = supplierData?.rating != null && !Number.isNaN(Number(supplierData.rating))
    ? Number(supplierData.rating).toFixed(1)
    : null
  const typeLabel = supplierData?.supplierType
    ? supplierTypeLabel(supplierData.supplierType)
    : supplierData?.businessType || null
  const locationValue = [supplierData?.city, supplierData?.country].filter(Boolean).join(', ')
    || supplierData?.address
    || null

  // Photos come exclusively from the images uploaded with this supplier's own
  // tours — never another operator's photos, and never the supplier logo.
  const photos: string[] = []
  const seenPhotos = new Set<string>()
  for (const tour of supplierTours) {
    const candidates = tour.photos?.length ? tour.photos : [tour.image]
    for (const src of candidates) {
      if (!src || seenPhotos.has(src)) continue
      seenPhotos.add(src)
      photos.push(src)
    }
  }

  const reviewTours: SupplierReviewTour[] = supplierTours.map((tour) => ({
    title: tour.title,
    location: tour.location,
    supplierName: tour.supplierName,
    rating: tour.rating,
    reviews: tour.reviews,
    ratingValue: tour.ratingValue,
  }))
  const reviewData = useSupplierReviews(reviewTours)
  const showReviews = reviewData.summary.count > 0 || reviewData.reviews.length > 0

  const railTours = supplierTours.slice(0, RAIL_TOURS)
  const tourRailRef = useRef<HTMLDivElement>(null)
  const tourRail = useCarouselRail(tourRailRef, CARD_WIDTH, CARD_GAP, railTours.length)

  const [logoFailed, setLogoFailed] = useState(false)
  const initials = profileName.split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase()
  // Alt text on a logo that sits next to the supplier's own <h1> is noise: it
  // spilled the name across the header whenever the image was still loading.
  const showLogo = Boolean(supplierData?.logo) && !logoFailed

  const miniDetails: MiniDetail[] = []
  if (locationValue) {
    miniDetails.push({ icon: <MapPin size={18} />, label: t('supplier.location'), value: locationValue })
  }
  if (supplierData?.operatingHours) {
    miniDetails.push({
      icon: <Clock size={18} />,
      label: t('supplier.openingHours'),
      value: supplierData.operatingHours,
      openNow: supplierData.isOpenNow === true,
    })
  }
  miniDetails.push({
    icon: <MessageCircle size={18} />,
    label: t('supplier.bookingSupport'),
    value: t('supplier.bookingSupportDesc'),
  })
  miniDetails.push({
    icon: <ShieldCheck size={18} />,
    label: t('supplier.verification'),
    value: supplierData?.verified ? t('supplier.verifiedProvider') : t('supplier.verifiedProviderPending'),
  })

  const handleMessageProvider = async () => {
    if (!supplierId) return
    if (!user) {
      setAuthReturnTo(location.pathname)
      navigate('/login')
      return
    }
    try {
      const conversation = await getOrCreateConversation(supplierId, 'SUPPLIER_CUSTOMER')
      navigate(`/dashboard/chat?conversation=${encodeURIComponent(conversation.id)}`)
    } catch {
      toast.error(t('supplier.messageError'))
    }
  }

  if (profileLoading) {
    return (
      <motion.div className="supplier-page" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.3 }}>
        <div className="supplier-page-nav-offset" aria-hidden />
        <div className="supplier-state">
          <p className="supplier-state-text">{t('supplier.loading')}</p>
        </div>
      </motion.div>
    )
  }

  if (profileError) {
    return (
      <motion.div className="supplier-page" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.3 }}>
        <div className="supplier-page-nav-offset" aria-hidden />
        <div className="supplier-state">
          <p className="supplier-state-text">{t('supplier.loadError')}</p>
          <button type="button" onClick={() => refetchProfile()} className="supplier-state-link">
            {t('supplier.retry')}
          </button>
        </div>
      </motion.div>
    )
  }

  if (!supplierData) {
    return (
      <motion.div className="supplier-page" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.3 }}>
        <div className="supplier-page-nav-offset" aria-hidden />
        <div className="supplier-state">
          <p className="supplier-state-text">{t('supplier.notFound')}</p>
          <Link to="/" className="supplier-state-link">
            {t('supplier.backToHome')}
          </Link>
        </div>
      </motion.div>
    )
  }

  return (
    <motion.div
      className="supplier-page"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.4, ease: 'easeInOut' }}
    >
      <SEO
        title={`${profileName} - Ghana Tour Operator`}
        description={`Book tours with ${profileName} on Travio Ghana. ${totalTours > 0 ? `${totalTours} experiences available.` : ''} ${ratingDisplay ? `Rated ${ratingDisplay}/5.` : ''} Authentic Ghana tours and experiences.`}
        keywords={`${profileName}, Ghana tour operator, Ghana tours, ${profileName} tours, Ghana experiences`}
        jsonLd={buildBreadcrumbSchema([
          { name: 'Home', url: 'https://www.travioghana.com/' },
          { name: profileName, url: `https://www.travioghana.com/supplier/${encodeURIComponent(segment)}` },
        ])}
      />
      <div className="supplier-page-nav-offset" aria-hidden />

      <main className="supplier-page-main">
        {/* Back row */}
        <div className="supplier-back-row">
          <button type="button" onClick={() => navigate(-1)} className="supplier-back-btn">
            <ArrowLeft size={18} />
            {t('supplier.back')}
          </button>
        </div>

        {/* Hero — identity, messaging, supplier-owned photos, provider details */}
        <section className="supplier-hero">
          <div className="supplier-hero-top">
            <div className="supplier-identity">
              <div className="supplier-hero-logo">
                {showLogo ? (
                  <OptimizedImage
                    src={supplierData.logo}
                    alt=""
                    width={200}
                    onError={() => setLogoFailed(true)}
                  />
                ) : (
                  <span className="supplier-hero-logo-fallback">{initials}</span>
                )}
                {supplierData.verified && (
                  <span className="supplier-verified" title={t('supplier.trustVerified')}>
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.4" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                  </span>
                )}
              </div>

              <div className="supplier-name-block">
                <h1>{profileName}</h1>
                <div className="supplier-name-rating">
                  {ratingDisplay && (
                    <>
                      <span className="supplier-score">{ratingDisplay}</span>
                      <StarRating
                        value={Number(supplierData.rating) || 0}
                        size={13}
                        gap={1}
                        filledColor="var(--bv-accent)"
                        emptyColor="#e5e7eb"
                      />
                    </>
                  )}
                  {reviewData.summary.count > 0 && (
                    <a href="#reviews" className="supplier-reviews-link">
                      {t('supplier.reviewCount', { count: reviewData.summary.count })}
                    </a>
                  )}
                </div>
              </div>
            </div>

            {supplierId && (
              <div className="supplier-hero-actions">
                <button type="button" className="supplier-message-btn" onClick={handleMessageProvider}>
                  <span className="supplier-message-icon">
                    <MessageCircle size={18} />
                  </span>
                  <span className="supplier-message-copy">
                    <strong>{t('supplier.messageProvider')}</strong>
                    <small>{t('supplier.messageProviderHint')}</small>
                  </span>
                </button>
              </div>
            )}
          </div>

          <SupplierPhotoStrip photos={photos} supplierName={profileName} />

          <div className="supplier-details">
            <h2>{t('supplier.providerDetails')}</h2>
            <div className="supplier-details-grid">
              {miniDetails.map((detail) => (
                <div key={detail.label} className="supplier-detail-card">
                  <span className="supplier-detail-icon">{detail.icon}</span>
                  <div className="supplier-detail-copy">
                    <small>{detail.label}</small>
                    <strong>{detail.value}</strong>
                    {detail.openNow && (
                      <span className="supplier-open-pill">
                        <span className="supplier-open-dot" aria-hidden="true" />
                        {t('supplier.openToday')}
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* About this supplier */}
        <section className="supplier-about-card">
          <h2>{t('supplier.aboutThisSupplier')}</h2>
          <div className="supplier-about-description">
            {supplierData.description
              ? supplierData.description.split('\n\n').map((p, i) => <p key={i}>{p}</p>)
              : <p>{t('supplier.noDescription', { name: profileName })}</p>}
          </div>

          <div className="supplier-stats">
            <div className="supplier-stat">
              <span className="supplier-stat-icon"><ShieldCheck size={28} /></span>
              <strong>{supplierData.verified ? t('supplier.trustVerified') : t('supplier.trustPending')}</strong>
              <span>{supplierData.verified ? t('supplier.trustVerifiedDesc') : t('supplier.trustPendingDesc')}</span>
            </div>
            {typeLabel && (
              <div className="supplier-stat">
                <span className="supplier-stat-icon"><Car size={28} /></span>
                <strong>{typeLabel}</strong>
                <span>{t('supplier.trustTypeDesc')}</span>
              </div>
            )}
            <div className="supplier-stat">
              <span className="supplier-stat-icon supplier-stat-icon-number">{totalTours}</span>
              <strong>{t('supplier.tours', { count: totalTours })}</strong>
              <span>{t('supplier.trustToursDesc')}</span>
            </div>
            {ratingDisplay && (
              <div className="supplier-stat">
                <span className="supplier-stat-icon"><Star size={28} fill="currentColor" /></span>
                <strong>{t('supplier.trustRating', { rating: ratingDisplay })}</strong>
                <span>{t('supplier.trustRatingDesc')}</span>
              </div>
            )}
          </div>
        </section>

        {/* Activities — the homepage's own tour cards, this supplier's tours only */}
        {(toursLoading || railTours.length > 0) && (
          <section className="supplier-activities">
            <div className="supplier-section-head" id="tours">
              <div>
                <h2>
                  {t('supplier.activitiesHeading')}{' '}
                  <span className="supplier-count">({totalTours})</span>
                </h2>
                <p>{t('supplier.activitiesSubtitle', { name: profileName })}</p>
              </div>
              <div className="supplier-section-actions">
                <button
                  type="button"
                  className="supplier-arrow-btn"
                  onClick={() => tourRail.scroll('left')}
                  disabled={!tourRail.canScrollLeft}
                  aria-label={t('supplier.previousActivities')}
                >
                  <ChevronLeft size={18} strokeWidth={2.2} />
                </button>
                <button
                  type="button"
                  className="supplier-arrow-btn"
                  onClick={() => tourRail.scroll('right')}
                  disabled={!tourRail.canScrollRight}
                  aria-label={t('supplier.nextActivities')}
                >
                  <ChevronRight size={18} strokeWidth={2.2} />
                </button>
                <Link to="/tours" className="supplier-view-all">
                  {t('supplier.viewAllActivities')}
                </Link>
              </div>
            </div>

            <div className="supplier-rail-card">
              {toursLoading && railTours.length === 0 ? (
                <p className="supplier-rail-loading">{t('supplier.loadingTours')}</p>
              ) : (
                <div className="supplier-rail-clip">
                  <div className="supplier-rail" ref={tourRailRef}>
                    {railTours.map((tour, i) => (
                      <div key={`${tour.id}-${i}`} className="supplier-card-wrap">
                        <TourCard {...tour} imageClean hideFeatures priority={i === 0} />
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </section>
        )}

        {/* Reviews — homepage cards beside the provider score breakdown */}
        {showReviews && (
          <SupplierReviewsSection
            summary={reviewData.summary}
            reviews={reviewData.reviews}
          />
        )}
      </main>

      <Footer />
    </motion.div>
  )
}
