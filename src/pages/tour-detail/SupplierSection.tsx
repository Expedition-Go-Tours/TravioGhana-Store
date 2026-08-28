import { useRef, useCallback, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Star, ChevronDown, ChevronRight, ChevronLeft, Phone, Mail, Globe, MapPin } from 'lucide-react'
import TourCard from '../../components/TourCard'
import type { TourCardData } from '../../hooks/useExpeditionTours'
import { supplierTypeLabel } from '../../lib/supplier'
import './SupplierSection.css'
import OptimizedImage from '@/components/shared/OptimizedImage'

interface SupplierSectionProps {
  name: string
  logo?: string
  description?: string
  rating: number | null
  totalTours: number
  phone?: string
  email?: string
  website?: string
  address?: string
  verified?: boolean
  supplierType?: string | null
  tours: TourCardData[]
  /** Id of the tour this section is rendered on — passed to the supplier page
      so it can resolve the real supplier profile without a name-only lookup. */
  tourId?: string
  onOpenInfo: () => void
  infoOpen: boolean
  onToggleInfo: () => void
}

const CARD_GAP = 16
const CARD_W_SM = 260
const CARD_W_MD = 280

export default function SupplierSection({
  name,
  logo,
  description,
  rating,
  totalTours,
  phone,
  email,
  website,
  address,
  verified,
  supplierType,
  tours,
  tourId,
  infoOpen,
  onToggleInfo,
}: SupplierSectionProps) {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const displayRating = rating != null ? rating.toFixed(1) : null
  const websiteHref = website
    ? website.startsWith('http') ? website : `https://${website}`
    : null
  const scrollRef = useRef<HTMLDivElement>(null)
  const [showLeftArrow, setShowLeftArrow] = useState(false)
  const [showRightArrow, setShowRightArrow] = useState(false)

  const updateArrows = useCallback(() => {
    const el = scrollRef.current
    if (!el) return
    const { scrollLeft, scrollWidth, clientWidth } = el
    const eps = 4
    setShowLeftArrow(scrollLeft > eps)
    setShowRightArrow(scrollLeft < scrollWidth - clientWidth - eps)
  }, [])

  useEffect(() => {
    const el = scrollRef.current
    if (!el) return
    updateArrows()
    el.addEventListener('scroll', updateArrows, { passive: true })
    const ro = typeof ResizeObserver !== 'undefined'
      ? new ResizeObserver(updateArrows)
      : null
    ro?.observe(el)
    window.addEventListener('resize', updateArrows)
    return () => {
      el.removeEventListener('scroll', updateArrows)
      ro?.disconnect()
      window.removeEventListener('resize', updateArrows)
    }
  }, [tours.length, updateArrows])

  const scrollBy = useCallback((dir: number) => {
    const el = scrollRef.current
    if (!el) return
    const card = window.innerWidth >= 640 ? CARD_W_MD : CARD_W_SM
    const step = card + CARD_GAP
    const maxScroll = el.scrollWidth - el.clientWidth
    const target = Math.max(0, Math.min(maxScroll, el.scrollLeft + dir * step * 3))
    el.scrollTo({ left: target, behavior: 'smooth' })
  }, [])

  return (
    <motion.div
      key="supplier"
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -12 }}
      transition={{ duration: 0.2, ease: 'easeOut' }}
    >
      <section className="supplier-section">
        <div className="supplier-header">
          <div className="supplier-header-left">
            <div className="supplier-logo">
              {logo ? (
                <OptimizedImage src={logo} alt="" className="supplier-logo-img" width={100} />
              ) : (
                <span className="supplier-logo-fallback">
                  {name.split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase()}
                </span>
              )}
            </div>
            <div>
              <h2 className="supplier-name">{name}</h2>
              {verified && (
                <span className="mt-1 inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                  Verified supplier
                </span>
              )}
              <div className="supplier-meta">
                {supplierType && (
                  <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-500">
                    {supplierTypeLabel(supplierType)}
                  </span>
                )}
                {displayRating && (
                  <>
                    <Star size={14} className="supplier-star" />
                    <span className="supplier-rating">{displayRating}</span>
                    <span className="supplier-dot">&bull;</span>
                  </>
                )}
                <span>{t('supplier.tours', { count: totalTours })}</span>
              </div>
            </div>
          </div>
        </div>

        {/* About & Contact */}
        <div className="supplier-about">
          <div className="supplier-about-header-row">
            <button
              type="button"
              onClick={onToggleInfo}
              className="supplier-about-trigger"
            >
              {t('supplier.aboutThisSupplier')}
              <motion.span
                animate={{ rotate: infoOpen ? 180 : 0 }}
                transition={{ duration: 0.25 }}
                className="supplier-about-chevron"
              >
                <ChevronDown size={16} />
              </motion.span>
            </button>
            <button
              type="button"
              onClick={() => navigate(`/supplier/${encodeURIComponent(name)}`, { state: { tourId } })}
              className="supplier-view-more"
            >
              {t('supplier.viewMore')}
              <ChevronRight size={16} strokeWidth={2} />
            </button>
          </div>
          <div
            className={`supplier-about-content ${infoOpen ? 'open' : ''}`}
          >
            <div className="supplier-about-body">
              {description && <p className="supplier-description">{description}</p>}
              <div className="supplier-contact">
                {phone && (
                  <div className="supplier-contact-item">
                    <Phone size={16} className="supplier-contact-icon" />
                    <a href={`tel:${phone.replace(/\s/g, '')}`}>{phone}</a>
                  </div>
                )}
                {email && (
                  <div className="supplier-contact-item">
                    <Mail size={16} className="supplier-contact-icon" />
                    <a href={`mailto:${email}`}>{email}</a>
                  </div>
                )}
                {websiteHref && (
                  <div className="supplier-contact-item">
                    <Globe size={16} className="supplier-contact-icon" />
                    <a href={websiteHref} target="_blank" rel="noopener noreferrer">
                      {website}
                    </a>
                  </div>
                )}
                {address && (
                  <div className="supplier-contact-item">
                    <MapPin size={16} className="supplier-contact-icon" />
                    <span>{address}</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Tours by this supplier */}
        {tours.length > 0 && (
          <div className="supplier-tours">
            <div className="supplier-tours-header">
              <h3 className="supplier-tours-title">{t('supplier.toursBySupplier')}</h3>
            </div>
            <div className="supplier-tours-scroll-wrapper">
              <button
                type="button"
                onClick={() => scrollBy(-1)}
                className="supplier-tours-scroll-arrow left"
                style={{ opacity: showLeftArrow ? 1 : 0, pointerEvents: showLeftArrow ? 'auto' : 'none' }}
                aria-label="Scroll left"
              >
                <ChevronLeft size={20} />
              </button>
              <div ref={scrollRef} className="supplier-tours-scroll">
                {tours.map((tour) => (
                  <div key={tour.title} className="supplier-tour-card-wrap">
                    <TourCard {...tour} imageClean hideFeatures />
                  </div>
                ))}
              </div>
              <button
                type="button"
                onClick={() => scrollBy(1)}
                className="supplier-tours-scroll-arrow right"
                style={{ opacity: showRightArrow ? 1 : 0, pointerEvents: showRightArrow ? 'auto' : 'none' }}
                aria-label="Scroll right"
              >
                <ChevronRight size={20} />
              </button>
            </div>
          </div>
        )}
      </section>
    </motion.div>
  )
}
