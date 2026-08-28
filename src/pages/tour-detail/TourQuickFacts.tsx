import { useRef, useState, useCallback, useEffect } from 'react'
import type { ComponentType, ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { AnimatePresence, motion } from 'framer-motion'
import { ChevronDown, ChevronRight } from 'lucide-react'
import './TourQuickFacts.css'

export interface QuickFactItem {
  icon: ComponentType<{ className?: string; strokeWidth?: number }>
  title: string
  desc: string | null
  renderValue?: () => ReactNode
}

interface TourQuickFactsProps {
  items: QuickFactItem[]
}

const ACCORDION_EASE = [0.22, 1, 0.36, 1] as const

/**
 * Horizontal strip of icon + feature-text facts (duration, difficulty, guide, etc.)
 * shown directly below the image gallery, GetYourGuide-style.
 *
 * Mobile: the facts sit in a swipeable carousel (snap-to-tile, full tiles per
 * view — never cut off) with a "View all" button beneath it. AnimatePresence
 * crossfades the carousel with the full 2-up grid, which expands/collapses
 * like an accordion. Desktop always shows the full grid; the carousel and
 * toggle are hidden there.
 */
export default function TourQuickFacts({ items }: TourQuickFactsProps) {
  const { t } = useTranslation()
  const [expanded, setExpanded] = useState(false)
  const wrapRef = useRef<HTMLDivElement>(null)
  const trackRef = useRef<HTMLDivElement>(null)
  const collapseRef = useRef(false)
  // Mobile carousel chrome: a chevron arrow over the right edge (swipe hint)
  // plus a dot indicator under the cards. Both are mobile-only and disappear
  // when the strip expands into the full 2-up grid.
  const [canScrollRight, setCanScrollRight] = useState(false)
  const [activeDot, setActiveDot] = useState(0)
  const perView = 2
  const pages = Math.max(1, Math.ceil(items.length / perView))

  const handleFactsScroll = useCallback(() => {
    const el = trackRef.current
    if (!el) return
    const eps = 4
    setCanScrollRight(el.scrollLeft < el.scrollWidth - el.clientWidth - eps)
    if (items.length > 0) {
      const tileStep = el.scrollWidth / items.length
      const tileIndex = Math.round(el.scrollLeft / tileStep)
      setActiveDot(Math.min(pages - 1, Math.max(0, Math.floor(tileIndex / perView))))
    }
  }, [items.length, pages])

  const scrollFactsForward = useCallback(() => {
    const el = trackRef.current
    if (!el || items.length === 0) return
    el.scrollBy({ left: el.scrollWidth / items.length, behavior: 'smooth' })
  }, [items.length])

  const scrollToPage = useCallback((page: number) => {
    const el = trackRef.current
    if (!el || items.length === 0) return
    const maxScroll = el.scrollWidth - el.clientWidth
    el.scrollTo({
      left: Math.min(page * perView * (el.scrollWidth / items.length), maxScroll),
      behavior: 'smooth',
    })
  }, [items.length])

  // Re-measure after layout settles (mount, font loads, orientation change).
  useEffect(() => {
    const raf = requestAnimationFrame(() => handleFactsScroll())
    const wrap = wrapRef.current
    let ro: ResizeObserver | null = null
    if (typeof ResizeObserver !== 'undefined' && wrap) {
      ro = new ResizeObserver(() => handleFactsScroll())
      ro.observe(wrap)
    }
    window.addEventListener('resize', handleFactsScroll)
    return () => {
      cancelAnimationFrame(raf)
      ro?.disconnect()
      window.removeEventListener('resize', handleFactsScroll)
    }
  }, [handleFactsScroll])

  // New fact set -> reset the indicator to the first tile.
  useEffect(() => {
    setActiveDot(0)
    const timer = window.setTimeout(() => handleFactsScroll(), 0)
    return () => window.clearTimeout(timer)
  }, [items.length, handleFactsScroll])

  const toggleExpanded = () => {
    collapseRef.current = expanded
    setExpanded((prev) => !prev)
  }

  // After the collapse animation finishes (page height settled), snap back so
  // the top of the quick-facts strip sits just below the sticky detail tabs.
  const scrollToSectionTop = () => {
    const el = wrapRef.current
    if (!el) return
    const tabsEl = document.querySelector<HTMLElement>('.tour-detail-tabs')
    const tabsHeight = tabsEl ? tabsEl.offsetHeight : 0
    const top = el.getBoundingClientRect().top + window.scrollY
    window.scrollTo({ top: Math.max(0, top - 64 - tabsHeight), behavior: 'smooth' })
  }

  const renderFacts = (): ReactNode =>
    items.map(({ icon: Icon, title, desc, renderValue }) => (
      <div key={title} className="tour-quick-fact">
        <div className="tour-quick-fact-icon">
          <Icon className="tour-quick-fact-icon-svg" strokeWidth={1.5} />
        </div>
        <div className="tour-quick-fact-body">
          {renderValue ? renderValue() : (
            <>
              <p className="tour-quick-fact-title">{title}</p>
              {desc && <p className="tour-quick-fact-desc">{desc}</p>}
            </>
          )}
        </div>
      </div>
    ))

  return (
    <>
      <div
        ref={wrapRef}
        className={`tour-quick-facts-wrap${expanded ? ' tour-quick-facts-wrap-expanded' : ''}`}
      >
        <AnimatePresence
          mode="popLayout"
          initial={false}
          onExitComplete={() => {
            if (collapseRef.current) {
              collapseRef.current = false
              scrollToSectionTop()
            }
          }}
        >
          {expanded ? (
            <motion.div
              key="facts-grid"
              className="tour-quick-facts tour-quick-facts-expanded"
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.45, ease: ACCORDION_EASE }}
            >
              {renderFacts()}
            </motion.div>
          ) : (
            <motion.div
              key="facts-carousel"
              ref={trackRef}
              className="tour-quick-facts"
              onScroll={handleFactsScroll}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0, scale: 0.98 }}
              transition={{ duration: 0.25, ease: 'easeInOut' }}
            >
              {renderFacts()}
            </motion.div>
          )}
        </AnimatePresence>

        {!expanded && (
          <button
            type="button"
            className={`tour-quick-facts-arrow${canScrollRight ? '' : ' tour-quick-facts-arrow-hidden'}`}
            onClick={scrollFactsForward}
            aria-label="Scroll quick facts"
          >
            <ChevronRight size={18} strokeWidth={2.5} />
          </button>
        )}

        {!expanded && pages > 1 && (
          <div className="tour-quick-facts-dots">
            {Array.from({ length: pages }).map((_, i) => (
              <button
                key={i}
                type="button"
                className={`tour-quick-facts-dot${activeDot === i ? ' tour-quick-facts-dot-active' : ''}`}
                onClick={() => scrollToPage(i)}
                aria-label={`Go to page ${i + 1}`}
                aria-current={activeDot === i}
              />
            ))}
          </div>
        )}
      </div>

      <button
        type="button"
        className={`tour-quick-facts-toggle${expanded ? ' tour-quick-facts-toggle-open' : ''}`}
        onClick={toggleExpanded}
        aria-expanded={expanded}
      >
        <span>{expanded ? t('tourDetail.viewLessFacts', 'View less') : t('tourDetail.viewAllFacts', 'View all')}</span>
        <ChevronDown size={16} strokeWidth={2.25} className="tour-quick-facts-toggle-chevron" />
      </button>
    </>
  )
}
