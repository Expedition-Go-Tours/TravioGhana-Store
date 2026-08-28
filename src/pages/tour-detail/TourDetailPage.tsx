import { Component, useState, useEffect, useMemo, useRef, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import {
  CalendarCheck, Clock, UserCheck, Bus, Gauge,
  Globe, Utensils, CupSoda, PawPrint, Accessibility, User,
  Wifi, Users, BedDouble, Heart, Upload,
} from 'lucide-react'
import Footer from '../../components/Footer'
import { useContinuePlanning, toContinuePlanningItem } from '../../context/ContinuePlanningContext'
import { useWishlist } from '../../context/WishlistContext'
import { toast } from 'sonner'
import { useTranslation } from 'react-i18next'
import { useExpeditionTour, useSimilarTours } from '../../hooks/useExpeditionTours'
import { useExpeditionTourReviews, useCreateReview } from '../../hooks/useExpeditionReviews'
import { useTourAvailability, useReviewableBookingForTour } from '../../hooks/useExpeditionBookings'
import { freeCancellationDateLabel } from '../../lib/cancellationLabel'
import { mapSupplierProfile } from '../../lib/supplierProfile'
import type { Tour } from '../../components/data'
import type { DayAvailability, DayAvailabilityInfo } from '../../lib/tourAvailability'

import TourImageGallery from './TourImageGallery'
import TourHeader from './TourHeader'
import TourQuickFacts from './TourQuickFacts'
import BookingWidget from './BookingWidget'
import RelatedTours from './RelatedTours'
import StickyNavHeader from './StickyNavHeader'

import TourDetailTabs from './TourDetailTabs'
import OverviewSection from './OverviewSection'
import DetailsSection, {
  buildIncludedExcludedContent,
  buildAboutContent,
  buildMeetingPickupContent,
  buildAccessibilityContent,
  buildCancellationContent,
  buildNotSuitableContent,
  buildNotAllowedContent,
  buildKnowBeforeContent,
} from './DetailsSection'
import TourItineraryPreview from './TourItineraryPreview'
import ReviewsSection from './ReviewsSection'
import SupplierSection from './SupplierSection'

import './TourDetailPage.css'

/** Skeleton placeholder shown while the tour loads: header, image gallery and booking widget. */
function TourDetailSkeleton() {
  return (
    <div className="tour-detail-skeleton" role="status" aria-label="Loading tour">
      <div className="tour-detail-container">
        {/* Header skeleton */}
        <div className="tour-detail-header-row">
          <div className="min-w-0 flex-1">
            <div className="skeleton-block h-7 w-2/3 max-w-md rounded-lg" />
            <div className="skeleton-block mt-3 h-4 w-1/3 max-w-xs rounded-md" />
            <div className="skeleton-block mt-2 h-4 w-1/4 max-w-[140px] rounded-md" />
          </div>
        </div>

        <div className="tour-detail-content">
          {/* Image gallery skeleton */}
          <div className="tour-detail-main">
            <div className="tour-detail-gallery-skeleton">
              <div className="skeleton-block skeleton-main-image" />
              <div className="skeleton-filmstrip">
                {[0, 1, 2, 3, 4].map((i) => (
                  <div key={i} className="skeleton-block skeleton-filmstrip-tile" />
                ))}
              </div>
            </div>
          </div>

          {/* Booking widget skeleton */}
          <aside className="tour-detail-sidebar">
            <div className="tour-detail-widget-skeleton">
              <div className="skeleton-block h-7 w-2/3 rounded-md" />
              <div className="skeleton-block mt-5 h-3 w-1/3 rounded" />
              <div className="skeleton-block mt-2 h-11 w-full rounded-xl" />
              <div className="skeleton-block mt-4 h-3 w-1/3 rounded" />
              <div className="skeleton-block mt-2 h-11 w-full rounded-xl" />
              <div className="skeleton-block mt-6 h-5 w-1/2 rounded" />
              <div className="skeleton-block mt-4 h-12 w-full rounded-xl" />
            </div>
          </aside>
        </div>
      </div>
    </div>
  )
}

interface TourDetailPageProps {
  onOpenAuth?: (mode: 'signin' | 'signup') => void
}

export default function TourDetailPage({ onOpenAuth }: TourDetailPageProps = {}) {
  const { t } = useTranslation()
  const tourDetailTabs = useMemo(() => [
    { key: 'overview', label: 'Overview' },
    { key: 'additional', label: t('tourDetail.additionalInformation') },
    { key: 'reviews', label: t('sections.reviews') },
    { key: 'supplier', label: t('tourDetail.supplier') },
  ], [t])
  const { tourId } = useParams<{ tourId: string }>()
  const navigate = useNavigate()
  const { isInWishlist, addToWishlist, removeFromWishlist } = useWishlist()
  const { addToContinuePlanning } = useContinuePlanning()

  const { data: tour, isLoading, isError } = useExpeditionTour(tourId)
  const { data: reviewsData } = useExpeditionTourReviews(tourId, 1, 10, tour?.id)
  const { data: reviewableBookingId } = useReviewableBookingForTour(tourId)
  const { data: similarTours } = useSimilarTours(tourId)

  // Availability is fetched for the calendar month the widget is currently
  // showing (the backend caps the public window at 31 days). Refetching on
  // month navigation keeps blocked/full dates accurate instead of letting
  // them silently fall back to "available".
  const [availMonth, setAvailMonth] = useState(() => {
    const now = new Date()
    return { year: now.getFullYear(), month: now.getMonth() }
  })
  const handleAvailabilityMonthChange = useCallback((year: number, month: number) => {
    setAvailMonth((prev) => (prev.year === year && prev.month === month ? prev : { year, month }))
  }, [])
  const availStart = useMemo(() => {
    const d = new Date(availMonth.year, availMonth.month, 1)
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  }, [availMonth])
  const availEnd = useMemo(() => {
    const d = new Date(availMonth.year, availMonth.month + 1, 0)
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  }, [availMonth])
  const { data: availabilityCalendar, isFetching: availabilityLoading } = useTourAvailability(tourId, availStart, availEnd)

  const availabilityMap = useMemo(() => {
    const map = new Map<string, DayAvailability>()
    if (availabilityCalendar) {
      for (const day of availabilityCalendar) {
        // day.status already incorporates BLOCKED overrides (computeStatus
        // returns BLOCKED for a blocked date) plus the supplier day-limit
        // "limited" derivation in mapDay — never override it with the stored
        // override status, which reads AVAILABLE for a capacity-only override.
        map.set(day.date, day.status)
      }
    }
    return map
  }, [availabilityCalendar])

  const availabilityInfoMap = useMemo(() => {
    const map = new Map<string, DayAvailabilityInfo>()
    if (availabilityCalendar) {
      for (const day of availabilityCalendar) {
        map.set(day.date, day)
      }
    }
    return map
  }, [availabilityCalendar])

  const reviews = useMemo(() => reviewsData?.reviews || [], [reviewsData])
  const relatedTours = useMemo(() => similarTours || [], [similarTours])

  const mergedImages = useMemo(() => {
    const seen = new Set<string>()
    const all = [
      ...(tour?.images || []),
    ]
    return all.filter((url) => {
      const key = String(url || '').toLowerCase().replace(/[?#].*$/, '').replace(/\/$/, '')
      if (!key || seen.has(key)) return false
      seen.add(key)
      return true
    })
  }, [tour?.images])

  useEffect(() => {
    if (tour) {
      document.title = `${tour.title} | Travio Ghana Tours`
    }
    if (tour) {
      addToContinuePlanning(toContinuePlanningItem({
        title: tour.title,
        location: tour.location,
        image: mergedImages[0] || '',
        photos: mergedImages,
        price: `$${tour.price}`,
        rating: String(tour.rating),
        reviews: tour.reviewCount,
        duration: tour.duration,
        features: tour.highlights?.length ? tour.highlights.slice(0, 4).join(' · ') : '',
        source: tour.bookingFlow === 'EXTERNAL' ? 'travio-ghana' as const : 'Travio Ghana' as const,
        externalUrl: tour.externalUrl || undefined,
        category: tour.category,
        difficulty: tour.difficulty,
        cancellationPolicy: tour.cancellationPolicy,
        pickupIncluded: tour.pickupIncluded,
        meetingMode: tour.meetingMode,
        languages: tour.languages,
        slug: tour.slug,
        specialOffers: tour.specialOffers,
      } as Tour))
    }
  }, [tour, addToContinuePlanning, mergedImages])

  // Mobile sticky-title behaviour: once the page title scrolls out of view the
  // tour title sticks to the top (below the navbar); when the detail tabs reach
  // the top they stick instead, so the title bar steps aside.
  const [showStickyTitle, setShowStickyTitle] = useState(false)
  useEffect(() => {
    const STICKY_TOP = 64
    const compute = () => {
      if (window.innerWidth >= 1024) {
        setShowStickyTitle(false)
        return
      }
      const header = document.querySelector<HTMLElement>('.tour-header-new')
      const tabs = document.querySelector<HTMLElement>('.tour-detail-tabs')
      if (!header || !tabs) return
      const headerGone = header.getBoundingClientRect().bottom <= STICKY_TOP + 1
      const tabsReached = tabs.getBoundingClientRect().top <= STICKY_TOP + 1
      setShowStickyTitle(headerGone && !tabsReached)
    }
    compute()
    window.addEventListener('scroll', compute, { passive: true })
    window.addEventListener('resize', compute)
    return () => {
      window.removeEventListener('scroll', compute)
      window.removeEventListener('resize', compute)
    }
  }, [])

  const pricingRef = useRef<HTMLDivElement>(null)
  const reviewsRef = useRef<HTMLDivElement>(null)
  const [activeTab, setActiveTab] = useState('overview')
  const [reviewDetail, setReviewDetail] = useState<{ name: string; date: string; rating: number; text: string } | null>(null)
  const [isWriteReviewOpen, setIsWriteReviewOpen] = useState(false)
  const [reviewStarFilter, setReviewStarFilter] = useState<number | null>(null)
  const [supplierInfoOpen, setSupplierInfoOpen] = useState(true)
  const [hasMoreReviews, setHasMoreReviews] = useState(false)
  const [loadingMoreReviews, setLoadingMoreReviews] = useState(false)
  const [isMobile, setIsMobile] = useState(false)
  const [widgetSelectedDate, setWidgetSelectedDate] = useState<Date | null>(null)

  const createReview = useCreateReview()

  useEffect(() => {
    const mq = window.matchMedia('(max-width: 768px)')
    window.setTimeout(() => setIsMobile(mq.matches), 0)
    const handler = (e: MediaQueryListEvent) => setIsMobile(e.matches)
    mq.addEventListener('change', handler)
    return () => mq.removeEventListener('change', handler)
  }, [])

  useEffect(() => {
    window.setTimeout(() => setActiveTab('overview'), 0)
    window.setTimeout(() => setReviewStarFilter(null), 0)
  }, [tourId])

  const isExternal = tour?.bookingFlow === 'EXTERNAL'
  const selectedTourTitle = tour?.title || ''
  const selectedTourRating = tour?.rating || 0
  const selectedTourReviews = tour?.reviewCount || 0
  const slug = tourId || tour?.slug || ''

  const wishlistItemId = tour?.id || selectedTourTitle
  const isFavorited = isInWishlist(wishlistItemId)

  const handleWishlistToggle = (suppressRemoveToast = false) => {
    if (isFavorited) {
      removeFromWishlist(wishlistItemId)
      if (!isMobile && !suppressRemoveToast) toast.success(t('common.removedFromWishlist'))
    } else {
      addToWishlist({
        id: wishlistItemId,
        tourId: tour?.id || undefined,
        title: selectedTourTitle,
        location: tour?.location || '',
        price: tour?.price || 0,
        duration: tour?.duration || '',
        imageUrl: mergedImages[0] || '',
        rating: selectedTourRating,
        reviewCount: selectedTourReviews,
        addedDate: new Date().toISOString(),
        source: isExternal ? 'travio-ghana' : 'Travio Ghana',
        externalUrl: tour?.externalUrl || undefined,
      })
      toast.success(t('common.addedToWishlist'))
    }
  }

  const handleShare = async () => {
    try {
      if (navigator.share) {
        await navigator.share({ title: selectedTourTitle, url: window.location.href })
      } else {
        await navigator.clipboard?.writeText(window.location.href)
      }
    } catch { /* ignore */ }
  }

  const handleWriteReview = () => {
    if (!reviewableBookingId) {
      toast.error(t('reviews.noCompletedBookingToReview', {
        defaultValue: 'You can only review this tour after completing a booking for it.',
      }))
      return
    }
    navigate(`/review/${encodeURIComponent(slug)}`, {
      state: {
        returnTo: `/tour/${slug}#reviews`,
        bookingId: reviewableBookingId,
        tour: {
          title: selectedTourTitle,
          slug,
          rating: selectedTourRating,
          reviews: selectedTourReviews,
          duration: tour?.duration || '',
          price: tour?.price || 0,
          image: mergedImages[0],
          images: mergedImages.slice(0, 5),
          location: tour?.location || 'Accra, Ghana',
          tourId: tour?.id || '',
          supplierName: tour?.supplierName || 'Travio Ghana Tours Ltd',
          supplierLogo: tour?.supplierPhoto || '',
        },
      },
    })
  }

  // Scrolls so the (sticky) tabs sit right below the navbar and the new tab's
  // content starts at the top of the viewport.
  const scrollTabContentIntoView = () => {
    const tabsEl = document.querySelector<HTMLElement>('.tour-detail-tabs')
    const contentEl = document.querySelector<HTMLElement>('.tour-detail-tab-content')
    if (!tabsEl || !contentEl) return
    // Place the tab content right below the sticky tabs (tabs stick at the
    // navbar offset), regardless of how far down the page was scrolled.
    const tabsHeight = tabsEl.offsetHeight
    const contentTop = contentEl.getBoundingClientRect().top + window.scrollY
    window.scrollTo({ top: contentTop - tabsHeight - 64, behavior: 'smooth' })
  }

  const handleTabChange = (tab: string) => {
    setActiveTab(tab)
    scrollTabContentIntoView()
  }

  const handleReviewsTab = () => handleTabChange('reviews')

  const loadMoreReviews = async () => {
    setLoadingMoreReviews(true)
    setTimeout(() => {
      setHasMoreReviews(false)
      setLoadingMoreReviews(false)
    }, 800)
  }

  const allReviewCards = useMemo(() => {
    return reviews.map((r) => ({
      id: r.id,
      name: r.author,
      tag: t('reviews.traveler'),
      date: new Date(r.date).toLocaleDateString('en-US', { month: 'short', year: 'numeric' }),
      rating: r.rating,
      text: r.content,
      title: r.title,
    }))
  }, [reviews, t])

  const filteredReviewCards = useMemo(() => {
    return allReviewCards.filter((r) => {
      if (reviewStarFilter !== null && r.rating !== reviewStarFilter) return false
      return true
    })
  }, [allReviewCards, reviewStarFilter])

  const reviewBreakdown = useMemo(() => {
    const labels = [
      { label: '5 stars', stars: 5 },
      { label: '4 stars', stars: 4 },
      { label: '3 stars', stars: 3 },
      { label: '2 stars', stars: 2 },
      { label: '1 star', stars: 1 },
    ]
    const counts: Record<number, number> = { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 }
    allReviewCards.forEach((r) => { if (counts[r.rating] !== undefined) counts[r.rating]++ })
    const total = allReviewCards.length || 1
    return labels.map((item) => ({
      ...item,
      count: counts[item.stars],
      percentage: Math.round((counts[item.stars] / total) * 100),
    }))
  }, [allReviewCards])

  const difficultyColorMap = useMemo<Record<string, string>>(() => ({
    'Easy': '#22c55e',
    'Moderate': '#f59e0b',
    'Challenging': '#ef4444',
    'Strenuous': '#dc2626',
    'Hard': '#ef4444',
    'Extreme': '#dc2626',
    'Expert': '#dc2626',
  }), [])

  const tourQuickFacts = useMemo(() => {
    // Reusable badge renderer — used for every Yes/No style quick fact so
    // unselected facts still show up (in red) instead of disappearing.
    const yesNoBadge = (isYes: boolean, yesLabel: string, noLabel: string) => (
      <span
        className="difficulty-grid-badge"
        style={isYes ? { backgroundColor: '#17923715', color: '#179237' } : { backgroundColor: '#ef444415', color: '#ef4444' }}
      >
        {isYes ? yesLabel : noLabel}
      </span>
    )

    // Difficulty is dynamic per tour — show the value when set, otherwise
    // fall back to a neutral "Not specified" state so the fact still renders.
    const rawDifficulty = tour?.difficulty?.trim()
    const diffLabel = rawDifficulty
      ? rawDifficulty.charAt(0).toUpperCase() + rawDifficulty.slice(1).toLowerCase()
      : ''
    const diffColor = diffLabel ? (difficultyColorMap[diffLabel] ?? '#6b7280') : '#9ca3af'

    // Skip-the-line feature is dynamic per tour (productContent.options[].skipTheLine).
    const skipTheLineLabel = (value: string): string => {
      switch (value) {
        case 'skip_tickets':
          return t('tourDetail.skipTheLineTickets')
        case 'express_security':
          return t('tourDetail.skipTheLineSecurity')
        case 'express_elevators':
          return t('tourDetail.skipTheLineElevators')
        case 'separate_entrance':
        default:
          return t('tourDetail.skipTheLine')
      }
    }
    const hasSkipTheLine = !!tour?.skipTheLine && tour.skipTheLine !== 'none'

    // Languages are dynamic per tour (productContent.writingLanguage + option languages).
    const languagesLabel = tour?.languages?.length
      ? tour.languages.join(', ')
      : t('tourDetail.guideLanguage')

    // Whether the itinerary spans multiple days (any stop assigned to a day
    // beyond the first). Overnight accommodation is only meaningful on such
    // itineraries, so the "Accommodation included" fact is gated on this.
    const isItineraryMultiDay = Array.isArray(tour?.itinerary)
      && tour.itinerary.some((stop) => (stop.day || 1) > 1)

    // Cancellation policy is dynamic per tour (bookingAndTickets.cancellationPolicy).
    // Supplier choices: "Standard" (free cancellation) vs "All sales final" (non-refundable).
    // Once the traveller picks a date in the booking widget, windowed free-cancellation
    // policies render with the concrete cutoff date (e.g. "before Aug 21st (local time)").
    const cancellationLabel = freeCancellationDateLabel(
      tour?.cancellationPolicy || t('tourDetail.cancellationDefault'),
      widgetSelectedDate ? widgetSelectedDate.toISOString().slice(0, 10) : '',
    )
    const isNonRefundableCancellation = /non[- ]?refundable|no refunds?|all sales final/i.test(cancellationLabel)

    // Food & drinks: build a descriptive label from meals / dietary options
    // (Step07 in the supplier product builder) when included, otherwise
    // render a clear "No" badge instead of hiding the fact.
    const foodIncluded = !!tour?.foodProvided
    const drinksIncluded = !!tour?.drinksIncluded
    const foodOrDrinksIncluded = foodIncluded || drinksIncluded
    const meals = tour?.meals || []
    const dietaryOptions = tour?.dietaryOptions || []
    // The badge itself should surface the actual meal option(s) the
    // supplier selected (e.g. "Breakfast, Lunch"), not a generic "Yes" —
    // same treatment as the Skip the line fact showing its chosen option.
    const mealTypesLabel = Array.from(new Set(meals.map((m) => m.type).filter(Boolean))).join(', ')
    const foodDrinkBadgeLabel = [
      foodIncluded && mealTypesLabel ? mealTypesLabel : (foodIncluded ? t('tourDetail.foodIncluded') : ''),
      drinksIncluded ? t('tourDetail.drinksIncluded') : '',
    ].filter(Boolean).join(' + ')
    const foodDrinkDescParts = [
      dietaryOptions.length ? t('tourDetail.dietaryOptionsSupported', { options: dietaryOptions.join(', ') }) : '',
    ].filter(Boolean)

    // Guide label — reflects the exact guide type the supplier selected in
    // the product builder's Guide information step: self-guided, tour guide,
    // host or greeter, instructor, or driver. "greeter" is a legacy alias.
    const guideLabel = (() => {
      switch (tour?.guideType) {
        case 'self-guided': return t('tourDetail.guideTypes.selfGuided')
        case 'tour-guide': return t('tourDetail.guideTypes.tourGuide')
        case 'driver': return t('tourDetail.guideTypes.driver')
        case 'instructor': return t('tourDetail.guideTypes.instructor')
        case 'host':
        case 'greeter': return t('tourDetail.guideTypes.host')
        default: return t('tourDetail.guideTypes.tourGuide')
      }
    })()

    // Private vs group experience — sourced from productContent.isPrivateActivity.
    const isPrivateExperience = !!tour?.isPrivateActivity

    return [
      // 1. Language — always shown, green accent since a language is always available.
      {
        icon: Globe,
        title: t('tourDetail.languages'),
        desc: null,
        renderValue: () => (
          <>
            <p className="tour-quick-fact-title">{t('tourDetail.languages')}</p>
            <span className="difficulty-grid-badge" style={{ backgroundColor: '#17923715', color: '#179237' }}>
              {languagesLabel}
            </span>
          </>
        ),
      },

      // 2. Duration — always shown, green accent when a real duration is set.
      {
        icon: Clock,
        title: t('tourDetail.duration'),
        desc: null,
        renderValue: () => (
          <>
            <p className="tour-quick-fact-title">{t('tourDetail.duration')}</p>
            {tour?.duration
              ? (
                <span className="difficulty-grid-badge" style={{ backgroundColor: '#17923715', color: '#179237' }}>
                  {tour.duration}
                </span>
              )
              : <p className="tour-quick-fact-desc">{t('tourDetail.checkAvailabilityDesc')}</p>}
          </>
        ),
      },

      // 3. Difficulty — always shown, neutral badge if not specified.
      {
        icon: Gauge,
        title: t('tourInfo.difficulty'),
        desc: null,
        renderValue: () => (
          <>
            <p className="tour-quick-fact-title">{t('tourInfo.difficulty')}</p>
            <span
              className="difficulty-grid-badge"
              style={{ backgroundColor: `${diffColor}15`, color: diffColor }}
            >
              {diffLabel || t('tourInfo.notSpecified', { defaultValue: 'Not specified' })}
            </span>
          </>
        ),
      },

      // 4. Pickup included — always shown, red "No" if not selected.
      {
        icon: Bus,
        title: t('tourDetail.pickupIncluded'),
        desc: null,
        renderValue: () => (
          <>
            <p className="tour-quick-fact-title">{t('tourDetail.pickupIncluded')}</p>
            {tour?.pickupIncluded
              ? yesNoBadge(true, t('tourDetail.yesLabel'), t('tourDetail.noLabel'))
              : yesNoBadge(false, t('tourDetail.yesLabel'), t('tourDetail.noLabel'))}
          </>
        ),
      },

      // 5. Guide information — always shown, title is fixed, content is
      // just the single selected guide type (e.g. "Tour guide").
      {
        icon: User,
        title: t('tourDetail.guideInformation'),
        desc: null,
        renderValue: () => (
          <>
            <p className="tour-quick-fact-title">{t('tourDetail.guideInformation')}</p>
            <span
              className="difficulty-grid-badge"
              style={{ backgroundColor: '#17923715', color: '#179237' }}
            >
              {guideLabel}
            </span>
          </>
        ),
      },

      // 6. Private experience — sourced from productContent.isPrivateActivity.
      {
        icon: isPrivateExperience ? Users : UserCheck,
        title: isPrivateExperience ? t('tourDetail.privateExperience') : t('tourDetail.groupExperience'),
        desc: null,
        renderValue: () => (
          <>
            <p className="tour-quick-fact-title">{t('tourDetail.privateExperience')}</p>
            {yesNoBadge(isPrivateExperience, t('tourDetail.yesLabel'), t('tourDetail.noLabel'))}
          </>
        ),
      },

      // 7. Skip the line — always shown, red "No" when not offered.
      {
        icon: UserCheck,
        title: t('tourDetail.skipTheLineTitle'),
        desc: null,
        renderValue: () => (
          <>
            <p className="tour-quick-fact-title">{t('tourDetail.skipTheLineTitle')}</p>
            {hasSkipTheLine
              ? yesNoBadge(true, skipTheLineLabel(tour!.skipTheLine as string), t('tourDetail.noLabel'))
              : yesNoBadge(false, t('tourDetail.yesLabel'), t('tourDetail.noLabel'))}
          </>
        ),
      },

      // 8. Cancellation policy — always shown; green when travellers can
      // cancel free, red when the supplier chose "All sales final".
      {
        icon: CalendarCheck,
        title: t('tourDetail.cancellationPolicy'),
        desc: null,
        renderValue: () => (
          <>
            <p className="tour-quick-fact-title">{t('tourDetail.cancellationPolicy')}</p>
            <span
              className="difficulty-grid-badge"
              style={isNonRefundableCancellation
                ? { backgroundColor: '#ef444415', color: '#ef4444' }
                : { backgroundColor: '#17923715', color: '#179237' }}
            >
              {cancellationLabel}
            </span>
          </>
        ),
      },

      // 9. Food and drinks included — badge shows the actual selected
      // option(s) (e.g. "Breakfast, Lunch" or "Breakfast + Drinks
      // included"), same treatment as Skip the line. Red "No" only when
      // nothing was selected in Step 07 of the supplier product builder.
      {
        icon: foodIncluded ? Utensils : CupSoda,
        title: t('tourDetail.foodAndDrinksIncluded'),
        desc: null,
        renderValue: () => (
          <>
            <p className="tour-quick-fact-title">{t('tourDetail.foodAndDrinksIncluded')}</p>
            {foodOrDrinksIncluded
              ? yesNoBadge(true, foodDrinkBadgeLabel || t('tourDetail.yesLabel'), t('tourDetail.noLabel'))
              : yesNoBadge(false, t('tourDetail.yesLabel'), t('tourDetail.noLabel'))}
            {foodOrDrinksIncluded && foodDrinkDescParts.length > 0 && (
              <p className="tour-quick-fact-desc">{foodDrinkDescParts.join(' · ')}</p>
            )}
          </>
        ),
      },

      // 10. Wheelchair accessible — always shown, red "No" if not selected.
      {
        icon: Accessibility,
        title: t('tourDetail.wheelchairAccessible'),
        desc: null,
        renderValue: () => (
          <>
            <p className="tour-quick-fact-title">{t('tourDetail.wheelchairAccessible')}</p>
            {yesNoBadge(!!tour?.wheelchairAccessible, t('tourDetail.yesLabel'), t('tourDetail.noLabel'))}
          </>
        ),
      },

      // 11. WiFi available — sourced from productContent.wifiIncluded (Step 11
      // "Extra information" of the supplier product builder, "Is WiFi or
      // internet included?"). Always shown with a red "No" when not offered.
      {
        icon: Wifi,
        title: t('tourDetail.wifiAvailable', { defaultValue: 'WiFi available' }),
        desc: null,
        renderValue: () => (
          <>
            <p className="tour-quick-fact-title">{t('tourDetail.wifiAvailable', { defaultValue: 'WiFi available' })}</p>
            {yesNoBadge(!!tour?.wifiIncluded, t('tourDetail.yesLabel'), t('tourDetail.noLabel'))}
          </>
        ),
      },

      // 12. Pets allowed — always shown, red "No" if not selected.
      {
        icon: PawPrint,
        title: t('tourDetail.petsAllowed'),
        desc: null,
        renderValue: () => (
          <>
            <p className="tour-quick-fact-title">{t('tourDetail.petsAllowed')}</p>
            {yesNoBadge(!!tour?.petFriendly, t('tourDetail.yesLabel'), t('tourDetail.noLabel'))}
          </>
        ),
      },

      // 13. Accommodation included — sourced from
      // categorization.accommodationIncluded (Step 02 of the supplier
      // product builder, "Is accommodation included?"). Only shown when the
      // itinerary is actually multi-day (a stop assigned to a day beyond the
      // first), so overnight accommodation isn't claimed for tours whose
      // itinerary has no overnight stops; red "No" when not offered.
      ...(isItineraryMultiDay
        ? [{
            icon: BedDouble,
            title: t('tourDetail.accommodationIncluded'),
            desc: null,
            renderValue: () => (
              <>
                <p className="tour-quick-fact-title">{t('tourDetail.accommodationIncluded')}</p>
                {yesNoBadge(!!tour?.accommodationIncluded, t('tourDetail.yesLabel'), t('tourDetail.noLabel'))}
              </>
            ),
          }]
        : []),
    ]
  }, [
    t, tour, difficultyColorMap, widgetSelectedDate,
  ])

  // Short teaser shown right after the gallery (GetYourGuide-style), no heading.
  const shortDescriptionText = useMemo(() => {
    if (tour?.shortDescription) return tour.shortDescription
    if (!tour?.description) return ''
    return tour.description.length > 250
      ? tour.description.slice(0, 250) + '...'
      : tour.description
  }, [tour])

  const highlights = tour?.highlights || []
  const cancellationPolicy = tour?.cancellationPolicy || 'Free cancellation up to 24 hours before'

  const descriptionSteps = useMemo(() => {
    const desc = tour?.description
    if (!desc) return []
    return [{
      title: t('tourDetail.fullDescription'),
      body: buildAboutContent(desc),
    }]
  }, [tour?.description, t])

  const additionalInfoSections = useMemo(() => [
    {
      key: 'notSuitable',
      title: t('tourDetail.notSuitableFor'),
      content: buildNotSuitableContent(tour?.notSuitableFor || []),
    },
    {
      key: 'notAllowed',
      title: t('tourDetail.notAllowed'),
      content: buildNotAllowedContent(tour?.notAllowed || []),
    },
    {
      key: 'knowBefore',
      title: t('tourDetail.knowBeforeYouGo'),
      content: buildKnowBeforeContent(tour?.additionalInfo || ''),
    },
    {
      key: 'pickup',
      title: t('tourDetail.meetingPickup'),
      content: buildMeetingPickupContent(tour),
    },
    {
      key: 'accessibility',
      title: t('tourDetail.accessibility'),
      content: buildAccessibilityContent('', '', ''),
    },
    {
      key: 'policy',
      title: t('tourDetail.cancellationPolicy'),
      content: buildCancellationContent(undefined, cancellationPolicy),
    },
  ], [t, cancellationPolicy, tour])

  const supplierData = useMemo(() => {
    const mapped = mapSupplierProfile({
      supplier: tour?.supplierProfile,
      fallback: {
        name: tour?.supplierName || 'Travio Ghana Tours Ltd',
        logo: tour?.supplierPhoto || '',
        description: tour?.supplierName ? `${tour.supplierName} offers authentic guided experiences.` : null,
        rating: tour?.rating,
        toursCount: relatedTours.length,
      },
    })
    return {
      name: mapped.name || tour?.supplierName || 'Travio Ghana Tours Ltd',
      logo: mapped.logo || tour?.supplierPhoto || '',
      description: mapped.description || (tour?.supplierName ? `${tour.supplierName} offers authentic guided experiences.` : ''),
      rating: mapped.rating ?? (tour?.rating ?? null),
      totalTours: relatedTours.length,
      phone: mapped.phone || '',
      email: mapped.email || '',
      website: mapped.website || '',
      address: mapped.address || tour?.location || '',
      verified: mapped.verified,
      supplierType: mapped.supplierType,
    }
  }, [tour, relatedTours])

  // Same full TourCardData as the "similar experiences" row — the Supplier
  // tab cards must carry the identical props (photos carousel, priceValue for
  // promo pricing, badges, real slug) so they render the same as everywhere
  // else. No degradation here.
  const supplierTours = relatedTours

  const handleWriteReviewSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const form = e.target as HTMLFormElement
    const comment = (form.elements.namedItem('review-comment') as HTMLTextAreaElement)?.value
    const ratingEl = form.elements.namedItem('review-rating') as HTMLInputElement
    const rating = ratingEl ? parseInt(ratingEl.value) : 5

    if (comment && tour?.id) {
      createReview.mutate({
        bookingId: tour.id,
        rating,
        comment,
        title: selectedTourTitle,
      })
    }
    setIsWriteReviewOpen(false)
    toast.success(t('reviews.thankYou'))
  }

  if (isLoading) {
    return <TourDetailSkeleton />
  }

  if (isError || !tour) {
    return (
      <div className="tour-detail-error" style={{ padding: '60px 24px', textAlign: 'center' }}>
        <h2>{t('tourDetail.tourNotFound')}</h2>
        <p>{t('tourDetail.tourNotFoundDesc')}</p>
      </div>
    )
  }

  return (
    <TourDetailErrorBoundary>
    <>
      <StickyNavHeader show={showStickyTitle} title={selectedTourTitle} onWriteReview={handleWriteReview} />
      <div className="tour-detail-page">
        <div className="tour-detail-container">
          <div className="tour-detail-header-row">
            <TourHeader
              title={selectedTourTitle}
              reviewCount={selectedTourReviews}
              location={tour.location}
              supplierName={tour.supplierName}
              onReviewsClick={handleReviewsTab}
            />
            <div className="tour-detail-header-actions">
              <button
                type="button"
                onClick={() => handleWishlistToggle(true)}
                className="tour-detail-action-btn tour-detail-wishlist-btn"
                aria-label={isFavorited ? t('common.removeFromWishlist') : t('common.addToWishlist')}
                aria-pressed={isFavorited}
              >
                <Heart size={20} className={isFavorited ? 'wishlist-active' : ''} />
              </button>
              <button
                type="button"
                onClick={handleShare}
                className="tour-detail-action-btn"
                aria-label={t('common.share', { defaultValue: 'Share' })}
              >
                <Upload size={20} />
              </button>
              <button
                type="button"
                onClick={handleWriteReview}
                className="tour-detail-write-review-btn"
              >
                {t('reviews.writeAReview')}
              </button>
            </div>
          </div>

          <div className="tour-detail-content">
            <div className="tour-detail-main">
              <TourImageGallery
                images={mergedImages}
                title={selectedTourTitle}
                fallbackImage={mergedImages[0]}
              />
            </div>

            <aside className="tour-detail-sidebar" ref={pricingRef}>
              {isExternal && tour.externalUrl ? (
                <div className="external-booking-card" style={{
                  background: '#fff', borderRadius: 12, padding: 24,
                  border: '1px solid #e5e7eb', boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
                  textAlign: 'center',
                }}>
                  <img src="/travio_logo.png" alt="Travio Africa" style={{ height: 32, marginBottom: 16 }} />
                  <p style={{ fontSize: 14, color: '#6b7280', marginBottom: 16 }}>
                    This tour is operated by a partner on Travio Africa
                  </p>
                  <a
                    href={tour.externalUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{
                      display: 'inline-block', width: '100%', padding: '12px 24px',
                      background: '#179237', color: '#fff', borderRadius: 8,
                      fontWeight: 600, textDecoration: 'none', fontSize: 16,
                    }}
                  >
                    Book on Travio Africa
                  </a>
                </div>
              ) : (
                <BookingWidget
                  tour={tour}
                  getAvailability={(date: Date) => {
                    const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
                    // Raw status only — the widget resolves the final day
                    // state (incl. the supplier's operating days) itself.
                    return availabilityMap.get(key)
                  }}
                  getDayInfo={(date: Date) => {
                    const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
                    return availabilityInfoMap.get(key)
                  }}
                  availabilityLoading={availabilityLoading}
                  onMonthChange={handleAvailabilityMonthChange}
                  onOpenAuth={onOpenAuth}
                  onSelectedDateChange={setWidgetSelectedDate}
                />
              )}
            </aside>

            <div className="tour-detail-bottom">
              <TourDetailTabs
                tabs={tourDetailTabs}
                activeTab={activeTab}
                onTabChange={handleTabChange}
              />

              <div className="tour-detail-tab-content">
                <AnimatePresence mode="wait">
                  {activeTab === 'overview' && (
                    <motion.div
                      key="overview"
                      initial={{ opacity: 0, y: 12 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -12 }}
                      transition={{ duration: 0.2, ease: 'easeOut' }}
                    >
                      <div className="tour-detail-overview">
                        {shortDescriptionText && (
                          <div className="tour-detail-short-description-block">
                            <h2 className="overview-section-title">{t('tourDetail.shortDescription')}</h2>
                            <p className="tour-detail-short-description">{shortDescriptionText}</p>
                          </div>
                        )}

                        <TourQuickFacts items={tourQuickFacts} />

                        <TourItineraryPreview
                          itinerary={tour.itinerary}
                          meeting={tour}
                          dropoff={tour}
                          accommodationIncluded={tour.accommodationIncluded}
                          meals={tour.meals}
                          dayLogistics={tour.dayLogistics}
                        />

                        <OverviewSection
                          descriptionSteps={descriptionSteps}
                          descriptionLong={(tour?.description?.length || 0) > 300}
                          highlights={highlights}
                          reviews={allReviewCards.map(r => ({ id: r.id, name: r.name, date: r.date, rating: r.rating, text: r.text, country: '' }))}
                          onTabChange={handleTabChange}
                          onReviewReadMore={setReviewDetail}
                        />

                        <section className="overview-includes">
                          <h2 className="overview-section-title">{t('tourDetail.included')}</h2>
                          {buildIncludedExcludedContent(tour?.included, tour?.excluded)}
                        </section>
                      </div>
                    </motion.div>
                  )}

                  {activeTab === 'additional' && (
                    <DetailsSection
                      key="additional"
                      sections={additionalInfoSections}
                    />
                  )}

                  {activeTab === 'reviews' && (
                    <div key="reviews" ref={reviewsRef} className="tour-detail-reviews-anchor">
                      <ReviewsSection
                        rating={selectedTourRating}
                        reviewCount={selectedTourReviews}
                        reviewBreakdown={reviewBreakdown}
                        reviews={filteredReviewCards}
                        hasMore={hasMoreReviews}
                        loadingMore={loadingMoreReviews}
                        onLoadMore={loadMoreReviews}
                        onWriteReview={handleWriteReview}
                        starFilter={reviewStarFilter}
                        onStarFilterChange={setReviewStarFilter}
                      />
                    </div>
                  )}

                  {activeTab === 'supplier' && (
                    <SupplierSection
                      key="supplier"
                      name={supplierData.name}
                      logo={supplierData.logo}
                      description={supplierData.description}
                      rating={supplierData.rating}
                      totalTours={supplierData.totalTours}
                      phone={supplierData.phone}
                      email={supplierData.email}
                      website={supplierData.website}
                      address={supplierData.address}
                      verified={supplierData.verified}
                      supplierType={supplierData.supplierType}
                      tours={supplierTours}
                      tourId={tour?.id}
                      infoOpen={supplierInfoOpen}
                      onToggleInfo={() => setSupplierInfoOpen((v) => !v)}
                      onOpenInfo={() => setSupplierInfoOpen(true)}
                    />
                  )}
                </AnimatePresence>
              </div>
            </div>
          </div>

          <RelatedTours tours={relatedTours} />
        </div>
      </div>

      <Footer />

      <AnimatePresence>
        {reviewDetail && (
          <motion.div
            className="dialog-overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={() => setReviewDetail(null)}
          >
            <motion.div
              className="dialog-content"
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              transition={{ duration: 0.2, ease: 'easeOut' }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="dialog-header">
                <h3 className="dialog-title">{t('tourDetail.reviewDetails')}</h3>
                <button type="button" onClick={() => setReviewDetail(null)} className="dialog-close">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                  </svg>
                </button>
              </div>
              <div className="dialog-body">
                <div className="review-detail-avatar">
                  {reviewDetail.name?.split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase()}
                </div>
                <p className="review-detail-name">{reviewDetail.name}</p>
                <p className="review-detail-date">{reviewDetail.date}</p>
                <div className="review-detail-stars">
                  {[...Array(5)].map((_, i) => (
                    <svg key={i} className={`star ${i < reviewDetail.rating ? 'filled' : ''}`} width="16" height="16" viewBox="0 0 24 24" fill={i < reviewDetail.rating ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2">
                      <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
                    </svg>
                  ))}
                </div>
                <p className="review-detail-text">{reviewDetail.text}</p>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {isWriteReviewOpen && (
        <div className="dialog-overlay" onClick={() => setIsWriteReviewOpen(false)}>
          <div className="dialog-content" onClick={(e) => e.stopPropagation()}>
            <div className="dialog-header">
              <h3 className="dialog-title">{t('reviews.writeAReview')}</h3>
              <button type="button" onClick={() => setIsWriteReviewOpen(false)} className="dialog-close">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>
            <div className="dialog-body">
              <p className="write-review-info">{t('reviews.shareExperience')}</p>
              <form onSubmit={handleWriteReviewSubmit} className="write-review-form-dialog">
                <input type="hidden" name="review-rating" value="5" />
                <div className="write-review-field">
                  <label>{t('reviews.yourRating')}</label>
                  <div className="write-review-stars">
                    {[1, 2, 3, 4, 5].map((star) => (
                      <button key={star} type="button" className="write-review-star-btn">
                        <svg width="36" height="36" viewBox="0 0 24 24" fill="#16a34a" stroke="#16a34a" strokeWidth="2">
                          <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
                        </svg>
                      </button>
                    ))}
                  </div>
                </div>
                <div className="write-review-field">
                  <label htmlFor="review-comment">{t('reviews.yourReview')}</label>
                  <textarea id="review-comment" name="review-comment" rows={5} required placeholder={t('reviews.contentPlaceholder')} className="write-review-textarea" />
                </div>
                <div className="reply-actions">
                  <button type="button" onClick={() => setIsWriteReviewOpen(false)} className="reply-cancel">{t('common.cancel')}</button>
                  <button type="submit" className="reply-submit">{t('reviews.postReview')}</button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </>
    </TourDetailErrorBoundary>
  )
}

class TourDetailErrorBoundary extends Component<{ children: React.ReactNode }, { hasError: boolean }> {
  constructor(props: { children: React.ReactNode }) {
    super(props)
    this.state = { hasError: false }
  }
  static getDerivedStateFromError() {
    return { hasError: true }
  }
  render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: '60px 24px', textAlign: 'center', fontFamily: 'sans-serif' }}>
          <h2 style={{ fontSize: 24, marginBottom: 8, color: '#1a1a1a' }}>Something went wrong</h2>
          <p style={{ fontSize: 16, color: '#6b7280' }}>Please try refreshing the page.</p>
        </div>
      )
    }
    return this.props.children
  }
}
