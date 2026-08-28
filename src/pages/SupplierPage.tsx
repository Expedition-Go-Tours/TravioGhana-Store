import { useState, useMemo } from 'react'
import { useParams, useNavigate, useLocation, Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import {
  ArrowLeft, Heart, MessageSquare, Star, Shield, Users, Headset,
  Phone, Mail, Globe, MapPin, ChevronDown,
} from 'lucide-react'
import TourCard from '../components/TourCard'
import Navbar from '../components/Navbar'
import Footer from '../components/Footer'
import { mapRawTourToListing, type TourCardData } from '../hooks/useExpeditionTours'
import { mapSupplierProfile, normalizeWebsiteUrl, type SupplierProfileData } from '../lib/supplierProfile'
import { apiFetch, fetchWithAuth } from '../lib/api'
import './SupplierPage.css'
import OptimizedImage from '@/components/shared/OptimizedImage'

const PAGE_SIZE = 8

const TRUST_BADGES = [
  { icon: Shield, title: 'Trusted Local Operator', desc: 'Verified & vetted' },
  { icon: Users, title: 'Great Reviews', desc: '4.9/5 from 15 travellers' },
  { icon: Star, title: 'Quality Experiences', desc: 'Handpicked tours' },
  { icon: Headset, title: 'Customer Support', desc: "We're here to help" },
]

const containerVariants = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.08 } },
}

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.4, ease: 'easeOut' as const } },
}

/** Fetch a raw tour by id/slug; returns null (not an error) when missing. */
async function fetchRawTourByIdOrSlug(idOrSlug: string): Promise<any | null> {
  try {
    const res = await fetchWithAuth(`/tours/${encodeURIComponent(idOrSlug)}`)
    if (!res.ok) return null
    const payload = await res.json().catch(() => ({}))
    return payload.data?.tour ?? payload.tour ?? payload ?? null
  } catch {
    return null
  }
}

/**
 * Resolves the raw tour that carries the supplier block. Prefers the linking
 * tour's id (passed in router state from the tour-detail supplier section);
 * on a direct URL visit it scans the active catalog for a supplier-name match.
 */
function useSupplierProfile(tourId: string | undefined, name: string) {
  return useQuery({
    queryKey: ['supplier', 'profile', tourId || name],
    enabled: !!(tourId || name),
    queryFn: async () => {
      if (tourId) {
        const tour = await fetchRawTourByIdOrSlug(tourId)
        if (tour) return tour
      }
      if (!name) return null
      try {
        const payload: any = await apiFetch('/tours?limit=500')
        const tours: any[] = Array.isArray(payload.tours) ? payload.tours : []
        const needle = name.toLowerCase().trim()
        return tours.find((t) => (t.supplier?.name || '').toLowerCase().trim() === needle) || null
      } catch {
        return null
      }
    },
    staleTime: 5 * 60_000,
  })
}

/** All active tours belonging to a supplier, fetched by supplier id. */
function useSupplierTours(supplierId: string | null) {
  return useQuery({
    queryKey: ['supplier', 'tours', supplierId],
    enabled: !!supplierId,
    queryFn: async (): Promise<TourCardData[]> => {
      const payload: any = await apiFetch(`/tours?supplierId=${encodeURIComponent(supplierId!)}&limit=100`)
      const tours: any[] = Array.isArray(payload.tours) ? payload.tours : []
      return tours.map(mapRawTourToListing)
    },
    staleTime: 30_000,
  })
}

export default function SupplierPage() {
  const { supplierName } = useParams()
  const navigate = useNavigate()
  const location = useLocation()
  const decodedName = supplierName ? decodeURIComponent(supplierName) : ''
  const tourId = (location.state as { tourId?: string } | null)?.tourId

  const { data: rawTour, isLoading: profileLoading } = useSupplierProfile(tourId, decodedName)
  const supplierData: SupplierProfileData | null = useMemo(
    () => (rawTour ? mapSupplierProfile({ tour: rawTour }) : null),
    [rawTour],
  )
  const supplierId = supplierData?.supplierId || null
  const { data: supplierTours = [], isLoading: toursLoading } = useSupplierTours(supplierId)

  const totalTours = supplierTours.length
  const profileName = supplierData?.name || decodedName || 'Travio Ghana Tours Ltd'
  const ratingDisplay = supplierData?.rating != null && !Number.isNaN(Number(supplierData.rating))
    ? Number(supplierData.rating).toFixed(1)
    : null
  const websiteHref = normalizeWebsiteUrl(supplierData?.website)

  const trustBadges = TRUST_BADGES.map((badge) =>
    badge.title === 'Trusted Local Operator'
      ? { ...badge, desc: supplierData?.verified ? 'Verified & vetted' : 'Verification in progress' }
      : badge
  )

  const [page, setPage] = useState(1)

  const startIdx = 0
  const endIdx = page * PAGE_SIZE
  const visibleTours = supplierTours.slice(startIdx, endIdx)
  const hasMore = endIdx < supplierTours.length

  if (profileLoading) {
    return (
      <motion.div className="min-h-screen bg-white" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.3 }}>
        <Navbar />
        <div className="supplier-page-nav-offset" aria-hidden />
        <div className="flex min-h-[calc(100vh-4rem)] flex-col items-center justify-center gap-4 px-4">
          <p className="text-sm text-slate-500">Loading supplier...</p>
        </div>
      </motion.div>
    )
  }

  if (!supplierData) {
    return (
      <motion.div className="min-h-screen bg-white" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.3 }}>
        <Navbar />
        <div className="supplier-page-nav-offset" aria-hidden />
        <div className="flex min-h-[calc(100vh-4rem)] flex-col items-center justify-center gap-4 px-4">
          <p className="text-sm text-slate-500">Supplier not found</p>
          <Link to="/" className="text-sm font-semibold text-emerald-600 hover:underline">
            Back to Home
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
      <Navbar />
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
            Back
          </button>
          <div className="supplier-nav-actions">
            <button type="button" className="supplier-save-btn">
              <Heart size={16} />
              Save
            </button>
            <button type="button" className="supplier-contact-btn">
              <MessageSquare size={16} />
              Contact
            </button>
          </div>
        </motion.div>

        {/* Supplier Header */}
        <motion.div variants={itemVariants} className="supplier-header-section">
            <div className="supplier-header-logo-wrap">
              <div className="supplier-header-logo">
                {supplierData.logo ? (
                  <OptimizedImage src={supplierData.logo} alt={profileName} width={200} />
                ) : (
                  <span className="supplier-header-logo-fallback">
                    {profileName.split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase()}
                  </span>
                )}
              </div>
              {supplierData.verified && (
                <div className="supplier-header-verified" title="Verified supplier">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                </div>
              )}
            </div>
          <div className="supplier-header-info">
            <h1 className="supplier-header-name">{profileName}</h1>
            <div className="supplier-header-meta">
              {ratingDisplay && (
                <>
                  <Star size={22} className="supplier-header-star" fill="#179237" />
                  <span className="supplier-header-rating">{ratingDisplay}</span>
                  <span className="supplier-header-dot">&bull;</span>
                </>
              )}
              <span className="supplier-header-tours">{totalTours} tours</span>
            </div>
          </div>
        </motion.div>

        {/* About + Contact — Two Column */}
        <motion.div variants={itemVariants} className="supplier-about-layout">
          {/* Left Card — About */}
          <div className="supplier-about-card">
            <h2 className="supplier-about-heading">About this supplier</h2>
            <div className="supplier-about-description">
              {supplierData.description ? supplierData.description.split('\n\n').map((p, i) => (
                <p key={i}>{p}</p>
              )) : <p>{profileName} offers guided experiences.</p>}
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
            <h3 className="supplier-contact-heading">Contact Information</h3>
            <div className="supplier-contact-list">
              {supplierData.phone && (
                <>
                  <div className="supplier-contact-row">
                    <div className="supplier-contact-icon-wrap">
                      <Phone size={16} />
                    </div>
                    <div className="supplier-contact-detail">
                      <span className="supplier-contact-label">Phone</span>
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
                      <span className="supplier-contact-label">Email</span>
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
                      <span className="supplier-contact-label">Website</span>
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
                <div className="supplier-contact-row">
                  <div className="supplier-contact-icon-wrap">
                    <MapPin size={16} />
                  </div>
                  <div className="supplier-contact-detail">
                    <span className="supplier-contact-label">Location</span>
                    <span className="supplier-contact-value">{supplierData.address}</span>
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
              All tours by this supplier
              <span className="supplier-tours-count">({totalTours} tours)</span>
            </h2>
            <div className="supplier-tours-sort">
              <span className="supplier-tours-sort-label">Sort by:</span>
              <span className="supplier-tours-sort-value">Recommended</span>
              <ChevronDown size={14} />
            </div>
          </div>

          {toursLoading && totalTours === 0 && (
            <p className="mt-4 text-sm text-slate-400">Loading tours...</p>
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
                View all {totalTours} tours
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
