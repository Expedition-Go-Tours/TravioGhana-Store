import { useState, useMemo, useEffect, useRef, type ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { ChevronLeft, ChevronRight, X, Star, ArrowLeft } from 'lucide-react'
import ExternalReviewCard from '../components/ExternalReviewCard'
import StarRating from '../components/StarRating'
import { useAllExternalReviews, useExternalReviewStats } from '../hooks/useExternalReviews'
import SEO, { buildBreadcrumbSchema, SITE_URL } from '../components/SEO'
import Footer from '../components/Footer'
import './AllReviewsPage.css'

const PAGE_SIZE = 20

type SortKey = 'recommended' | 'highest' | 'lowest' | 'newest'

function applySort(reviews: ExternalReview[], sortKey: SortKey): ExternalReview[] {
  const arr = [...reviews]
  switch (sortKey) {
    case 'highest':
      return arr.sort((a, b) => b.rating - a.rating)
    case 'lowest':
      return arr.sort((a, b) => a.rating - b.rating)
    case 'newest':
      return arr.sort((a, b) => {
        const da = a.originalDate ? new Date(a.originalDate).getTime() : 0
        const db = b.originalDate ? new Date(b.originalDate).getTime() : 0
        return db - da
      })
    default:
      return arr
  }
}

const RATING_OPTIONS = [
  { value: '5', label: '5' },
  { value: '4', label: '4' },
  { value: '3', label: '3' },
  { value: '2', label: '2' },
  { value: '1', label: '1' },
] as const

const SOURCE_OPTIONS = [
  { value: 'TRIPADVISOR', label: 'TripAdvisor' },
  { value: 'GETYOURGUIDE', label: 'GetYourGuide' },
  { value: 'GOOGLE', label: 'Google' },
] as const

interface ExternalReview {
  id: string
  source: 'TRIPADVISOR' | 'GETYOURGUIDE' | 'GOOGLE'
  reviewerName: string
  reviewerAvatar: string | null
  rating: number
  title: string | null
  text: string
  textTruncated: string | null
  tourTitle: string
  tourThumbnail: string | null
  tourUrl: string
  tourLink: string
  coverPhoto: string | null
  originalDate: string | null
}

function FilterSection({
  title,
  options,
  selected,
  onChange,
  single,
  renderLabel,
}: {
  title: string
  options: { value: string; label: string }[]
  selected: string[]
  onChange: (value: string) => void
  single?: boolean
  renderLabel?: (opt: { value: string; label: string }) => ReactNode
}) {
  return (
    <div className="filter-drawer-section">
      <h3 className="filter-drawer-section-title">{title}</h3>
      <div className="filter-drawer-options">
        {options.map((opt) => {
          const isActive = selected.includes(opt.value)
          return (
            <button
              key={opt.value}
              type="button"
              className={`filter-drawer-option ${isActive ? 'active' : ''}`}
              onClick={() => onChange(opt.value)}
            >
              <span className={`filter-drawer-check ${isActive ? 'checked' : ''}`}>
                {isActive && <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>}
              </span>
              <span>{renderLabel ? renderLabel(opt) : opt.label}</span>
              {single && isActive && <span className="filter-drawer-single-indicator">•</span>}
            </button>
          )
        })}
      </div>
    </div>
  )
}

export default function AllReviewsPage() {
  const navigate = useNavigate()
  const { data: allReviews, isLoading } = useAllExternalReviews()
  const { data: stats } = useExternalReviewStats()

  const [sourceFilter, setSourceFilter] = useState<string[]>([])
  const [ratingFilter, setRatingFilter] = useState<string[]>([])
  const [sortBy, setSortBy] = useState<string[]>(['recommended'])
  const [page, setPage] = useState(1)
  const [drawerOpen, setDrawerOpen] = useState(false)

  const sortByVal = (sortBy[0] || 'recommended') as SortKey

  const sortOptions = useMemo(() => [
    { value: 'recommended', label: 'Recommended' },
    { value: 'highest', label: 'Highest Rated' },
    { value: 'lowest', label: 'Lowest Rated' },
    { value: 'newest', label: 'Newest' },
  ] as const, [])

  const handleMulti = (setter: React.Dispatch<React.SetStateAction<string[]>>) =>
    (value: string) => setter(prev => prev.includes(value) ? prev.filter(v => v !== value) : [...prev, value])

  const handleSingle = (setter: React.Dispatch<React.SetStateAction<string[]>>) =>
    (value: string) => setter(prev => prev[0] === value ? [] : [value])

  const clearAll = () => {
    setSourceFilter([]); setRatingFilter([]); setSortBy(['recommended']); setPage(1)
  }

  const activeFilterCount = sourceFilter.length + ratingFilter.length

  // Reset page on filter change
  useEffect(() => {
    window.setTimeout(() => setPage(1), 0)
  }, [sourceFilter, ratingFilter, sortBy])

  const filteredReviews = useMemo(() => {
    let list = allReviews || []

    if (sourceFilter.length > 0) {
      list = list.filter(r => sourceFilter.includes(r.source))
    }
    if (ratingFilter.length > 0) {
      const minRating = Math.min(...ratingFilter.map(Number))
      list = list.filter(r => r.rating >= minRating)
    }

    return applySort(list, sortByVal)
  }, [allReviews, sourceFilter, ratingFilter, sortByVal])

  const totalCount = filteredReviews.length
  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE))
  const hasNextPage = page < totalPages
  const hasPrevPage = page > 1

  // Pagination controls sit at the very bottom of the list: after a page swap,
  // glide back to the top of the page and take keyboard focus along, so the
  // new reviews are never left off-screen behind the user. Honours the user's
  // reduced-motion preference (instant jump instead of a smooth glide).
  const headingRef = useRef<HTMLHeadingElement>(null)
  const returnToResultsTop = () => {
    const reduceMotion =
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches
    window.scrollTo({ top: 0, behavior: reduceMotion ? 'auto' : 'smooth' })
    headingRef.current?.focus({ preventScroll: true })
  }

  const goNextPage = () => {
    if (!hasNextPage) return
    setPage(p => p + 1)
    returnToResultsTop()
  }

  const goPrevPage = () => {
    if (!hasPrevPage) return
    setPage(p => Math.max(1, p - 1))
    returnToResultsTop()
  }

  const displayReviews = useMemo(
    () => filteredReviews.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE),
    [filteredReviews, page],
  )

  const allPillOptions = useMemo(() => {
    const pills: { key: string; value: string; label: string }[] = []
    SOURCE_OPTIONS.forEach(o => pills.push({ key: `src-${o.value}`, value: o.value, label: o.label }))
    RATING_OPTIONS.forEach(r => pills.push({ key: `rating-${r.value}`, value: r.value, label: `${r.label} stars` }))
    return pills
  }, [])

  const isPillActive = (value: string) => {
    return sourceFilter.includes(value) || ratingFilter.includes(value)
  }

  const handlePillToggle = (value: string) => {
    if (SOURCE_OPTIONS.some(o => o.value === value)) { handleMulti(setSourceFilter)(value); return }
    if (RATING_OPTIONS.some(r => r.value === value)) { handleMulti(setRatingFilter)(value); return }
  }

  return (
    <div className="all-reviews-page">
      {/* Matches the prerendered /reviews copy the crawlers receive. */}
      <SEO
        title="Reviews & Testimonials"
        description="Read reviews from travelers who booked Ghana tours through Travio Ghana."
        keywords="Ghana tours reviews, Travio Ghana reviews"
        jsonLd={buildBreadcrumbSchema([
          { name: 'Home', url: `${SITE_URL}/` },
          { name: 'Reviews', url: `${SITE_URL}/reviews` },
        ])}
      />
      <div className="all-reviews-container">
        {/* Header */}
        <div className="all-reviews-header">
          <div className="all-reviews-header-left">
            <button
              onClick={() => navigate('/')}
              className="all-reviews-back-btn"
              aria-label="Back to homepage"
            >
              <ArrowLeft size={20} />
            </button>
            <div>
              <h1 className="all-reviews-title" ref={headingRef} tabIndex={-1}>What Travelers Are Saying</h1>
              {isLoading ? (
                <p className="all-reviews-count">Loading reviews...</p>
              ) : (
                <p className="all-reviews-count">
                  {totalCount === 1
                    ? '1 review'
                    : `${totalCount} reviews`}
                </p>
              )}
            </div>
          </div>
          {activeFilterCount > 0 && (
            <button className="all-reviews-clear" onClick={clearAll}>Clear filters</button>
          )}
        </div>

        {/* Stats bar */}
        {stats && (
          <div className="all-reviews-stats">
            <div className="all-reviews-stats__rating">
              <span className="all-reviews-stats__number">{stats.averageRating}</span>
              <div className="all-reviews-stats__stars">
                <StarRating
                  value={stats.averageRating ?? 0}
                  size={20}
                  gap={1}
                  filledColor="#16a34a"
                  emptyColor="#e5e7eb"
                />
              </div>
            </div>
            <span className="all-reviews-stats__divider" />
            <span className="all-reviews-stats__text">
              From <strong>{stats.totalReviews}</strong> reviews
            </span>
          </div>
        )}

        {/* Sticky filter bar */}
        <div className="filter-bar-sticky">
          <div className="filter-bar">
            <div className="filter-pills-scroll">
              {allPillOptions.map((pill) => {
                const active = isPillActive(pill.value)
                return (
                  <button
                    key={pill.key}
                    type="button"
                    className={`filter-pill ${active ? 'active' : ''}`}
                    onClick={() => handlePillToggle(pill.value)}
                  >
                    {pill.label}
                    {active && <X size={12} className="filter-pill-x" />}
                  </button>
                )
              })}
            </div>
          </div>
        </div>

        {/* Loading state */}
        {isLoading && (
          <div className="all-reviews-grid">
            {Array.from({ length: PAGE_SIZE }).map((_, i) => (
              <div key={i} className="all-reviews-card-skeleton">
                <div className="all-reviews-card-skeleton-body" />
              </div>
            ))}
          </div>
        )}

        {/* Reviews grid */}
        {!isLoading && (
          <div className="all-reviews-grid">
            <AnimatePresence mode="popLayout">
              {displayReviews.map((review) => (
                <motion.div
                  key={review.id}
                  layout
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.9 }}
                  transition={{ duration: 0.25 }}
                >
                  <ExternalReviewCard review={review} />
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        )}

        {/* Empty state */}
        {!isLoading && displayReviews.length === 0 && (
          <div className="all-reviews-empty">
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <circle cx="11" cy="11" r="8" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
            <h3>No reviews match your filters</h3>
            <p>Try adjusting your filters to see more reviews.</p>
            <button className="all-reviews-clear-btn" onClick={clearAll}>Clear all filters</button>
          </div>
        )}

        {/* Pagination */}
        {!isLoading && (hasNextPage || hasPrevPage) && (
          <div className="all-reviews-pagination">
            <div className="pagination-controls">
              <button
                className="all-reviews-load-btn"
                onClick={goPrevPage}
                disabled={!hasPrevPage}
                style={{ opacity: hasPrevPage ? 1 : 0.4 }}
              >
                <ChevronLeft size={14} />
                Previous
              </button>
              <span className="pagination-indicator" aria-live="polite">
                Page {page} of {totalPages}
              </span>
              <button
                className="all-reviews-load-btn"
                onClick={goNextPage}
                disabled={!hasNextPage}
                style={{ opacity: hasNextPage ? 1 : 0.4 }}
              >
                Next
                <ChevronRight size={14} />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Filter drawer */}
      <AnimatePresence>
        {drawerOpen && (
          <>
            <motion.div
              className="filter-drawer-overlay"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              onClick={() => setDrawerOpen(false)}
            />
            <motion.div
              className="filter-drawer"
              initial={{ x: '-100%' }}
              animate={{ x: 0 }}
              exit={{ x: '-100%' }}
              transition={{ type: 'spring', damping: 30, stiffness: 300 }}
            >
              <div className="filter-drawer-header">
                <h2 className="filter-drawer-title">Filters</h2>
                <button type="button" className="filter-drawer-close" onClick={() => setDrawerOpen(false)}>
                  <X size={18} />
                </button>
              </div>
              {activeFilterCount > 0 && (
                <button className="filter-drawer-clear" onClick={clearAll}>
                  Clear filters ({activeFilterCount})
                </button>
              )}

              <div className="filter-drawer-sections">
                <FilterSection
                  title="Rating"
                  options={[...RATING_OPTIONS]}
                  selected={ratingFilter}
                  onChange={handleMulti(setRatingFilter)}
                  renderLabel={(opt) => (
                    <span className="filter-rating-label">
                      <span className="filter-rating-number">{opt.label}</span>
                      {Array.from({ length: Number(opt.value) }, (_, i) => (
                        <Star key={i} size={14} className="filter-star-icon" />
                      ))}
                    </span>
                  )}
                />
                <FilterSection
                  title="Source"
                  options={[...SOURCE_OPTIONS]}
                  selected={sourceFilter}
                  onChange={handleMulti(setSourceFilter)}
                />
                <FilterSection
                  title="Sort by"
                  options={[...sortOptions]}
                  selected={sortBy}
                  onChange={handleSingle(setSortBy)}
                  single
                />
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Every other page ends with the footer; without it this page was the
          only inventory route with no internal links out of it at all. */}
      <Footer />
    </div>
  )
}
