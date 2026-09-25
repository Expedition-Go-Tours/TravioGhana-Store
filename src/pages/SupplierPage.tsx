import { useState, useMemo } from 'react'
import type { ComponentType } from 'react'
import { useParams, useNavigate, useLocation, Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { motion } from 'framer-motion'
import {
  ArrowLeft, Star, Shield, Award, Users,
  Phone, Mail, Globe, MapPin, ChevronDown, Clock, Share2,
} from 'lucide-react'
import TourCard from '../components/TourCard'
import Footer from '../components/Footer'
import SocialBrandIcon from '../components/shared/SocialBrandIcon'
import SEO, { buildBreadcrumbSchema } from '../components/SEO'
import { mapSupplierProfile, normalizeWebsiteUrl, type SupplierProfileData } from '../lib/supplierProfile'
import { classifySupplierSegment } from '../lib/supplierResolution'
import { supplierTypeLabel } from '../lib/supplier'
import { useSupplierProfile, useSupplierTours } from '../hooks/useSupplierProfile'
import './SupplierPage.css'
import OptimizedImage from '@/components/shared/OptimizedImage'

const PAGE_SIZE = 8

const containerVariants = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.08 } },
}

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.4, ease: 'easeOut' as const } },
}

interface TrustBadge {
  icon: ComponentType<{ size?: number | string; className?: string }>
  title: string
  desc: string
}

export default function SupplierPage() {
  const { supplierName } = useParams()
  const { t } = useTranslation()
  const navigate = useNavigate()
  const location = useLocation()
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
  const supplierData: SupplierProfileData | null = useMemo(
    () => (rawTour ? mapSupplierProfile({ tour: rawTour }) : null),
    [rawTour],
  )
  const supplierId = supplierData?.supplierId || null
  const { data: toursResult, isLoading: toursLoading } = useSupplierTours(supplierId)
  const supplierTours = toursResult?.tours ?? []
  // `pagination.totalCount` is authoritative; the fetched array is only a
  // fallback for when the API omits pagination.
  const totalTours = toursResult?.totalCount ?? supplierTours.length

  // A supplier id in the URL is not a name — never print a cuid as the heading.
  const profileName = supplierData?.name || routeIdentity.name || t('supplier.unknownName')
  const ratingDisplay = supplierData?.rating != null && !Number.isNaN(Number(supplierData.rating))
    ? Number(supplierData.rating).toFixed(1)
    : null
  const websiteHref = normalizeWebsiteUrl(supplierData?.website)
  const typeLabel = supplierData?.supplierType
    ? supplierTypeLabel(supplierData.supplierType)
    : supplierData?.businessType || null

  const [page, setPage] = useState(1)
  const [logoFailed, setLogoFailed] = useState(false)

  const initials = profileName.split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase()
  // Alt text on a logo that sits next to the supplier's own <h1> is noise: it
  // spilled the name across the header whenever the image was still loading.
  const showLogo = Boolean(supplierData?.logo) && !logoFailed

  const endIdx = page * PAGE_SIZE
  const visibleTours = supplierTours.slice(0, endIdx)
  const hasMore = endIdx < supplierTours.length

  // Built inline rather than with useMemo: the React Compiler memoizes this
  // itself and rejects a manual dependency list that is narrower than what it
  // infers (it treats `supplierData` as the dependency, not its properties).
  const trustBadges: TrustBadge[] = [
    supplierData?.verified
      ? { icon: Shield, title: t('supplier.trustVerified'), desc: t('supplier.trustVerifiedDesc') }
      : { icon: Shield, title: t('supplier.trustPending'), desc: t('supplier.trustPendingDesc') },
  ]
  if (typeLabel) {
    trustBadges.push({ icon: Award, title: typeLabel, desc: t('supplier.trustTypeDesc') })
  }
  trustBadges.push({ icon: Users, title: t('supplier.tours', { count: totalTours }), desc: t('supplier.trustToursDesc') })
  if (ratingDisplay) {
    trustBadges.push({ icon: Star, title: t('supplier.trustRating', { rating: ratingDisplay }), desc: t('supplier.trustRatingDesc') })
  } else if (supplierData?.city || supplierData?.country) {
    trustBadges.push({
      icon: MapPin,
      title: supplierData.city || supplierData.country || '',
      desc: t('supplier.trustLocationDesc'),
    })
  }

  if (profileLoading) {
    return (
      <motion.div className="min-h-screen bg-white" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.3 }}>
        <div className="supplier-page-nav-offset" aria-hidden />
        <div className="flex min-h-[calc(100vh-4rem)] flex-col items-center justify-center gap-4 px-4">
          <p className="text-sm text-slate-500">{t('supplier.loading')}</p>
        </div>
      </motion.div>
    )
  }

  if (profileError) {
    return (
      <motion.div className="min-h-screen bg-white" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.3 }}>
        <div className="supplier-page-nav-offset" aria-hidden />
        <div className="flex min-h-[calc(100vh-4rem)] flex-col items-center justify-center gap-4 px-4">
          <p className="text-sm text-slate-500">{t('supplier.loadError')}</p>
          <button
            type="button"
            onClick={() => refetchProfile()}
            className="text-sm font-semibold text-emerald-600 hover:underline"
          >
            {t('supplier.retry')}
          </button>
        </div>
      </motion.div>
    )
  }

  if (!supplierData) {
    return (
      <motion.div className="min-h-screen bg-white" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.3 }}>
        <div className="supplier-page-nav-offset" aria-hidden />
        <div className="flex min-h-[calc(100vh-4rem)] flex-col items-center justify-center gap-4 px-4">
          <p className="text-sm text-slate-500">{t('supplier.notFound')}</p>
          <Link to="/" className="text-sm font-semibold text-emerald-600 hover:underline">
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

      <motion.main
        className="supplier-page-main"
        variants={containerVariants}
        initial="hidden"
        animate="visible"
      >
        {/* Navigation Row */}
        <motion.div variants={itemVariants} className="supplier-nav-row">
          <button type="button" onClick={() => navigate(-1)} className="supplier-back-btn">
            <ArrowLeft size={18} />
            {t('supplier.back')}
          </button>
        </motion.div>

        {/* Supplier Header */}
        <motion.div variants={itemVariants} className="supplier-header-section">
            <div className="supplier-header-logo-wrap">
              <div className="supplier-header-logo">
                {showLogo ? (
                  <OptimizedImage
                    src={supplierData.logo}
                    alt=""
                    width={200}
                    onError={() => setLogoFailed(true)}
                  />
                ) : (
                  <span className="supplier-header-logo-fallback">{initials}</span>
                )}
              </div>
              {supplierData.verified && (
                <div className="supplier-header-verified" title={t('supplier.trustVerified')}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                </div>
              )}
            </div>
          <div className="supplier-header-info">
            <h1 className="supplier-header-name">{profileName}</h1>
            {supplierData.legalName && (
              <p className="mt-1 text-sm text-slate-500">
                {t('supplier.registeredAs', { name: supplierData.legalName })}
              </p>
            )}
            <div className="supplier-header-meta">
              {typeLabel && (
                <span className="mr-2 rounded-full bg-slate-100 px-2.5 py-0.5 text-[11px] font-medium text-slate-600">
                  {typeLabel}
                </span>
              )}
              {ratingDisplay && (
                <>
                  <Star size={22} className="supplier-header-star" fill="#179237" />
                  <span className="supplier-header-rating">{ratingDisplay}</span>
                  <span className="supplier-header-dot">&bull;</span>
                </>
              )}
              <span className="supplier-header-tours">{t('supplier.tours', { count: totalTours })}</span>
            </div>
          </div>
        </motion.div>

        {/* About + Contact — Two Column */}
        <motion.div variants={itemVariants} className="supplier-about-layout">
          {/* Left Card — About */}
          <div className="supplier-about-card">
            <h2 className="supplier-about-heading">{t('supplier.aboutThisSupplier')}</h2>
            <div className="supplier-about-description">
              {supplierData.description ? supplierData.description.split('\n\n').map((p, i) => (
                <p key={i}>{p}</p>
              )) : <p>{t('supplier.noDescription', { name: profileName })}</p>}
            </div>
            <div className="supplier-about-features">
              {trustBadges.map((badge) => (
                <div key={badge.title} className="supplier-trust-badge">
                  <div className="supplier-trust-badge-icon">
                    <badge.icon size={22} />
                  </div>
                  <div className="supplier-trust-badge-text">
                    <span className="supplier-trust-badge-title">{badge.title}</span>
                    <span className="supplier-trust-badge-desc">{badge.desc}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Right Card — Contact */}
          <div className="supplier-contact-card">
            <h3 className="supplier-contact-heading">{t('supplier.contactInformation')}</h3>
            <div className="supplier-contact-list">
              {supplierData.phone && (
                <>
                  <div className="supplier-contact-row">
                    <div className="supplier-contact-icon-wrap">
                      <Phone size={16} />
                    </div>
                    <div className="supplier-contact-detail">
                      <span className="supplier-contact-label">{t('supplier.phone')}</span>
                      <a href={`tel:${supplierData.phone.replace(/\s/g, '')}`} className="supplier-contact-value">
                        {supplierData.phone}
                      </a>
                    </div>
                  </div>
                  <div className="supplier-contact-divider" />
                </>
              )}
              {supplierData.email && (
                <>
                  <div className="supplier-contact-row">
                    <div className="supplier-contact-icon-wrap">
                      <Mail size={16} />
                    </div>
                    <div className="supplier-contact-detail">
                      <span className="supplier-contact-label">{t('supplier.email')}</span>
                      <a href={`mailto:${supplierData.email}`} className="supplier-contact-value">
                        {supplierData.email}
                      </a>
                    </div>
                  </div>
                  <div className="supplier-contact-divider" />
                </>
              )}
              {websiteHref && (
                <>
                  <div className="supplier-contact-row">
                    <div className="supplier-contact-icon-wrap">
                      <Globe size={16} />
                    </div>
                    <div className="supplier-contact-detail">
                      <span className="supplier-contact-label">{t('supplier.website')}</span>
                      <a
                        href={websiteHref}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="supplier-contact-value"
                      >
                        {supplierData.website}
                      </a>
                    </div>
                  </div>
                  <div className="supplier-contact-divider" />
                </>
              )}
              {supplierData.address && (
                <>
                  <div className="supplier-contact-row">
                    <div className="supplier-contact-icon-wrap">
                      <MapPin size={16} />
                    </div>
                    <div className="supplier-contact-detail">
                      <span className="supplier-contact-label">{t('supplier.location')}</span>
                      <span className="supplier-contact-value">{supplierData.address}</span>
                    </div>
                  </div>
                  {(supplierData.operatingHours || supplierData.socials.length > 0) && <div className="supplier-contact-divider" />}
                </>
              )}
              {supplierData.operatingHours && (
                <>
                  <div className="supplier-contact-row">
                    <div className="supplier-contact-icon-wrap">
                      <Clock size={16} />
                    </div>
                    <div className="supplier-contact-detail">
                      <span className="supplier-contact-label">{t('supplier.openingHours')}</span>
                      <span className="supplier-contact-value">{supplierData.operatingHours}</span>
                    </div>
                  </div>
                  {supplierData.socials.length > 0 && <div className="supplier-contact-divider" />}
                </>
              )}
              {supplierData.socials.length > 0 && (
                <div className="supplier-contact-row">
                  <div className="supplier-contact-icon-wrap">
                    <Share2 size={16} />
                  </div>
                  <div className="supplier-contact-detail">
                    <span className="supplier-contact-label">{t('supplier.follow')}</span>
                    <div className="flex flex-wrap gap-2 pt-0.5">
                      {supplierData.socials.map((social) => (
                        <a
                          key={social.network}
                          href={social.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-700 transition-colors hover:bg-slate-200"
                        >
                          <SocialBrandIcon network={social.network} size={14} />
                          {social.label}
                        </a>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </motion.div>

        {/* Tours Section */}
        <motion.div variants={itemVariants} className="supplier-tours-section">
          <div className="supplier-tours-header">
            <h2 className="supplier-tours-heading">
              {t('supplier.allToursBySupplier')}
              <span className="supplier-tours-count">({t('supplier.tours', { count: totalTours })})</span>
            </h2>
          </div>

          {toursLoading && supplierTours.length === 0 && (
            <p className="mt-4 text-sm text-slate-400">{t('supplier.loadingTours')}</p>
          )}

          <div className="supplier-tours-grid">
            {visibleTours.map((tour, i) => (
              <TourCard key={`${tour.title}-${i}`} {...tour} imageClean hideFeatures />
            ))}
          </div>

          {hasMore && (
            <div className="supplier-tours-bottom">
              <button
                type="button"
                onClick={() => setPage((p) => p + 1)}
                className="supplier-tours-view-all"
              >
                {t('supplier.viewAllTours', { count: totalTours })}
                <ChevronDown size={16} style={{ transform: 'rotate(-90deg)' }} />
              </button>
            </div>
          )}
        </motion.div>
      </motion.main>

      <Footer />
    </motion.div>
  )
}
