import { useState, useEffect, useMemo, useRef, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { useTranslation } from 'react-i18next'
import { X, Search, ChevronLeft, ChevronRight } from 'lucide-react'
import { usePopularDestinations } from '../hooks/useHomepageSections'
import PopularLocationCard from './PopularLocationCard'
import './DestinationsModal.css'

interface DestinationsModalProps {
  isOpen: boolean
  onClose: () => void
}

export default function DestinationsModal({ isOpen, onClose }: DestinationsModalProps) {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedRegion, setSelectedRegion] = useState('all')
  const panelRef = useRef<HTMLDivElement>(null)
  const regionScrollRef = useRef<HTMLDivElement>(null)
  const [showRegionLeft, setShowRegionLeft] = useState(false)
  const [showRegionRight, setShowRegionRight] = useState(false)

  const { data: liveDestinations } = usePopularDestinations(50)
  const apiDestinations = useMemo(() => {
    if (!liveDestinations?.length) return null
    return liveDestinations.map(d => ({
      title: d.city,
      tours: d.tourCount > 0 ? `${d.tourCount}+ Tours` : 'Explore',
      image: d.heroImage || 'https://images.unsplash.com/photo-1590181076255-de1dbbc106ed?auto=format&fit=crop&w=800&q=80',
      region: d.country || '',
    }))
  }, [liveDestinations])

  const activeDestinations = apiDestinations ?? []

  const updateRegionArrows = useCallback(() => {
    const el = regionScrollRef.current
    if (!el) return
    const eps = 4
    setShowRegionLeft(el.scrollLeft > eps)
    setShowRegionRight(el.scrollLeft < el.scrollWidth - el.clientWidth - eps)
  }, [])

  useEffect(() => {
    const el = regionScrollRef.current
    if (!el) return
    updateRegionArrows()
    el.addEventListener('scroll', updateRegionArrows, { passive: true })
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(updateRegionArrows) : null
    ro?.observe(el)
    return () => {
      el.removeEventListener('scroll', updateRegionArrows)
      ro?.disconnect()
    }
  }, [updateRegionArrows])

  const scrollRegion = (dir: number) => {
    regionScrollRef.current?.scrollBy({ left: dir * 200, behavior: 'smooth' })
  }

  // Body scroll lock
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }
    return () => { document.body.style.overflow = '' }
  }, [isOpen])

  // Escape to close
  useEffect(() => {
    if (!isOpen) return
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handleKey)
    return () => document.removeEventListener('keydown', handleKey)
  }, [isOpen, onClose])

  // Reset search/region when opening
  useEffect(() => {
    if (isOpen) {
      window.setTimeout(() => setSearchQuery(''), 0)
      window.setTimeout(() => setSelectedRegion('all'), 0)
    }
  }, [isOpen])

  const regions = useMemo(() => {
    const set = new Set(activeDestinations.map((d) => d.region))
    return ['all', ...Array.from(set).sort()]
  }, [activeDestinations])

  const filtered = useMemo(() => {
    let result = activeDestinations
    if (selectedRegion !== 'all') {
      result = result.filter((d) => d.region === selectedRegion)
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase()
      result = result.filter((d) => d.title.toLowerCase().includes(q))
    }
    return result
  }, [activeDestinations, selectedRegion, searchQuery])

  const visibleItems = filtered.slice(0, 8)

  const handleNavigate = useCallback(
    (title: string) => {
      onClose()
      navigate(`/tours?location=${encodeURIComponent(title)}`)
    },
    [navigate, onClose]
  )

  const handleExploreRegion = useCallback(
    (region: string) => {
      onClose()
      navigate(`/tours?location=${encodeURIComponent(region)}`)
    },
    [navigate, onClose]
  )

  // Group by region when "All Regions" is selected and no search
  const groupedByRegion = useMemo(() => {
    if (selectedRegion !== 'all' || searchQuery.trim()) return null
    const map = new Map<string, typeof activeDestinations>()
    activeDestinations.forEach((d) => {
      if (!map.has(d.region)) map.set(d.region, [])
      map.get(d.region)!.push(d)
    })
    return Array.from(map.entries()).map(([region, items]) => ({
      region,
      items: items.slice(0, 3),
    }))
  }, [activeDestinations, selectedRegion, searchQuery])

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            className="destinations-overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.22, ease: 'easeOut' }}
            onClick={onClose}
          />
          <motion.div
            ref={panelRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="destinations-modal-title"
            className="destinations-panel"
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ duration: 0.34, ease: [0.22, 1, 0.36, 1] }}
          >
            {/* Header */}
            <div className="destinations-header">
              <div>
                <h2 id="destinations-modal-title" className="destinations-title">{t('destinations.title')}</h2>
                <p className="destinations-subtitle">{t('destinations.subtitle')}</p>
              </div>
              <button onClick={onClose} className="destinations-close" aria-label={t('common.close')}>
                <X size={24} />
              </button>
            </div>

            {/* Search */}
            <div className="destinations-search-wrap">
              <div className="destinations-search">
                <Search size={16} className="destinations-search-icon" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder={t('hero.destinationPlaceholder')}
                  className="destinations-search-input"
                />
              </div>
            </div>

            {/* Region chips */}
            <div className="destinations-regions">
              <button
                type="button"
                className={`destinations-region-arrow left ${showRegionLeft ? 'visible' : ''}`}
                onClick={() => scrollRegion(-1)}
                aria-label={t('common.scrollLeft')}
              >
                <ChevronLeft size={18} />
              </button>
              <div ref={regionScrollRef} className="destinations-regions-scroll">
                {regions.map((region) => (
                  <button
                    key={region}
                    onClick={() => setSelectedRegion(region)}
                    className={`destinations-region-chip ${selectedRegion === region ? 'active' : ''}`}
                  >
                    {region === 'all' ? t('destinations.allRegions') : region}
                  </button>
                ))}
              </div>
              <button
                type="button"
                className={`destinations-region-arrow right ${showRegionRight ? 'visible' : ''}`}
                onClick={() => scrollRegion(1)}
                aria-label={t('common.scrollRight')}
              >
                <ChevronRight size={18} />
              </button>
            </div>

            {/* Content */}
            <div className="destinations-content">
              {/* Filtered / Popular grid */}
              <div className="destinations-section">
                <h3 className="destinations-section-title">
                  {searchQuery.trim()
                    ? `${filtered.length} ${filtered.length === 1 ? t('destinations.destination') : t('destinations.destinations')}`
                    : t('destinations.popular')}
                </h3>
                {filtered.length > 0 ? (
                  <div className="destinations-grid">
                    {visibleItems.map((dest, i) => (
                      <motion.div
                        key={`${dest.title}-${i}`}
                        initial={{ opacity: 0, y: 12 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.25, delay: i * 0.04, ease: 'easeOut' }}
                        className="destinations-grid-item"
                        onClick={() => handleNavigate(dest.title)}
                      >
                        <PopularLocationCard {...dest} />
                      </motion.div>
                    ))}
                  </div>
                ) : (
                  <div className="destinations-empty">
                    {t('destinations.noResults')}
                  </div>
                )}
              </div>

              {/* Region groups */}
              {groupedByRegion && groupedByRegion.map(({ region, items }) => (
                <div key={region} className="destinations-region-group">
                  <div className="destinations-region-header">
                    <h4 className="destinations-region-name">{region}</h4>
                    <button
                      onClick={() => handleExploreRegion(region)}
                      className="destinations-explore-btn"
                    >
                      {t('destinations.explore')}
                    </button>
                  </div>
                  <div className="destinations-grid">
                    {items.map((dest, i) => (
                      <div
                        key={`${dest.title}-${i}`}
                        className="destinations-grid-item"
                        onClick={() => handleNavigate(dest.title)}
                      >
                        <PopularLocationCard {...dest} />
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}
