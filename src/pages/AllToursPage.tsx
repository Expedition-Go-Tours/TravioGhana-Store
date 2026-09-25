import { useState, useMemo, useRef, useCallback, useEffect, type ReactNode } from 'react'
import { useSearchParams, useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { ChevronLeft, ChevronRight, X, Star, ArrowLeft, MapPin } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import TourCard from '../components/TourCard'
import TourCardSkeleton from '../components/TourCardSkeleton'
import NoToursEmptyState from '../components/NoToursEmptyState'
import { useLocationSearch } from '../context/LocationSearchContext'

import SEO, { buildItemListSchema, buildBreadcrumbSchema } from '../components/SEO'
import { useAllExpeditionTours, useTourFilterOptions, type TourCardData } from '../hooks/useExpeditionTours'
import { useSectionTourIds, useHomepageOffers, useAttractionTours, useLikelySellOut, type HomepageOfferTour } from '../hooks/useHomepageSections'
import './AllToursPage.css'

const PAGE_SIZE = 12

function computeDiscountLabel(t: HomepageOfferTour): string | undefined {
  if (t.discountType === 'PERCENTAGE' && t.discountPercentage) {
    return `-${t.discountPercentage}%`
  }
  if (t.discountType === 'FIXED_AMOUNT' && t.fixedDiscountValue && t.startingPrice) {
    const pct = Math.round((t.fixedDiscountValue / t.startingPrice) * 100)
    if (pct > 0) return `-${pct}%`
  }
  return undefined
}

/** Mirrors SellOutContext's normalized-title matching so the All Tours page
    tags the same tours as the homepage's sell-out provider. */
function normalizeTitle(title: string): string {
  return title.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()
}

const RATING_OPTIONS = [
  { value: '5', label: '5' },
  { value: '4', label: '4' },
  { value: '3', label: '3' },
  { value: '2', label: '2' },
  { value: '1', label: '1' },
] as const

/** Maps a homepage section to a client-side sort key used when the user hasn't
    picked an explicit sort (the "recommended" default). */
function sectionSortKey(sectionParam: string): 'rating' | 'popular' | 'recommended' {
  if (sectionParam === 'Top Rated') return 'rating'
  if (sectionParam === 'Sell Out' || sectionParam === 'Last Minute Deals') return 'popular'
  return 'recommended'
}

type SortKey = 'recommended' | 'rating' | 'popular' | 'price-low' | 'price-high' | 'near' | 'place'

/** GYG-style popularity: rating weighted by review volume. */
function popularityValue(tour: TourCardData): number {
  return (tour.ratingValue ?? 0) * Math.log10((tour.reviews ?? 0) + 1)
}

/**
 * GYG-style place band: 0 = belongs to the searched place (based there / visits
 * it — flagged by the backend as `placeMatch`), 1 = near it (<= 50 km),
 * 2 = everywhere else. Popularity decides the order inside a band, so a
 * far-away popular tour never overtakes one that belongs to the place.
 */
function placeTier(tour: TourCardData): number {
  // Backend-provided fine relevance: 0-3 in-place (based there / title /
  // attractions-tags / description), 4 nearby. Falls back to the coarse
  // placeMatch + distance pair for endpoints that don't compute placeRank.
  if (tour.placeRank != null) return tour.placeRank
  if (tour.placeMatch) return 0
  if (tour.distanceKm != null && tour.distanceKm <= 50) return 1
  return 2
}

/**
 * Proximity tier for the "Closest" sort: 0 = in the searched city, 1 = nearby
 * (<= 50 km), 2 = everything else with coordinates, 3 = no coordinates (last).
 * Quality breaks ties within a tier, so the best tours in each location band
 * lead — a mediocre tour 1 km away never outranks a 5-star 40 km away.
 */
function nearTier(tour: TourCardData, city: string): number {
  if (city) {
    const loc = tour.location.toLowerCase()
    const c = city.toLowerCase()
    if (loc === c || loc.startsWith(`${c},`)) return 0
  }
  const d = tour.distanceKm
  if (d == null) return 3
  if (d <= 50) return 1
  return 2
}

function applySort(tours: TourCardData[], sortKey: SortKey, nearCity = ''): TourCardData[] {
  const arr = [...tours]
  switch (sortKey) {
    case 'rating':
      return arr.sort((a, b) => (b.ratingValue ?? 0) - (a.ratingValue ?? 0))
    case 'popular':
      return arr.sort((a, b) => b.reviews - a.reviews)
    case 'price-low':
      return arr.sort((a, b) => (a.priceValue ?? Infinity) - (b.priceValue ?? Infinity))
    case 'price-high':
      return arr.sort((a, b) => (b.priceValue ?? -Infinity) - (a.priceValue ?? -Infinity))
    case 'near':
      return arr.sort((a, b) => {
        const ta = nearTier(a, nearCity)
        const tb = nearTier(b, nearCity)
        if (ta !== tb) return ta - tb
        return (b.ratingValue ?? 0) - (a.ratingValue ?? 0)
      })
    case 'place':
      return arr.sort((a, b) => {
        const ta = placeTier(a)
        const tb = placeTier(b)
        if (ta !== tb) return ta - tb
        const pa = popularityValue(a)
        const pb = popularityValue(b)
        if (pb !== pa) return pb - pa
        return (b.ratingValue ?? 0) - (a.ratingValue ?? 0)
      })
    default:
      // recommended — keep the backend's curated catalog order
      return arr
  }
}

export default function AllToursPage() {
  const { t } = useTranslation()
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const { currentLocation, setLocation } = useLocationSearch()
  const sectionParam = searchParams.get('section') || ''
  const locationParam = searchParams.get('location') || ''
  const categoryParam = searchParams.get('category') || ''
  const moodParam = searchParams.get('mood') || ''
  const nearParam = searchParams.get('near') || ''
  const placeParam = searchParams.get('place') || ''
  const attractionParam = searchParams.get('attraction') || ''

  const [tourTypes, setTourTypes] = useState<string[]>([])
  const [destinations, setDestinations] = useState<string[]>([])
  const [categories, setCategories] = useState<string[]>([])
  const [durationFilter, setDurationFilter] = useState<string[]>([])
  const [priceFilter, setPriceFilter] = useState<string[]>([])
  const [ratingFilter, setRatingFilter] = useState<string[]>([])
  const [sortBy, setSortBy] = useState<string[]>(['recommended'])
  const [page, setPage] = useState(1)
  const [drawerOpen, setDrawerOpen] = useState(false)

  const sortByVal = (sortBy[0] || 'recommended') as SortKey

  const TOUR_TYPE_OPTIONS = useMemo(() => [
    { value: 'day', label: t('allTours.typeDay') },
    { value: 'multi-day', label: t('allTours.typeMulti') },
  ] as const, [t])

  const DURATION_BUCKETS = useMemo(() => [
    { value: 'under-4', label: t('allTours.duration1'), match: (m: number) => m > 0 && m < 240 },
    { value: '4-6', label: t('allTours.duration2'), match: (m: number) => m >= 240 && m <= 360 },
    { value: 'full-day', label: t('allTours.duration3'), match: (m: number) => m > 360 && m < 1440 },
    { value: '2-3-days', label: t('allTours.duration4'), match: (m: number) => m >= 2880 && m <= 4320 },
    { value: '4-plus-days', label: t('allTours.duration5'), match: (m: number) => m > 4320 },
  ], [t])

  const PRICE_RANGES = useMemo(() => [
    { value: 'under-50', label: t('allTours.price1'), match: (p: number) => p < 50 },
    { value: '50-100', label: t('allTours.price2'), match: (p: number) => p >= 50 && p <= 100 },
    { value: '100-200', label: t('allTours.price3'), match: (p: number) => p > 100 && p <= 200 },
    { value: 'over-200', label: t('allTours.price4'), match: (p: number) => p > 200 },
  ], [t])

  const SECTION_TITLES: Record<string, string> = useMemo(() => ({
    'Recommended': t('allTours.sectionRecommended'),
    'Day Tours': t('allTours.sectionDayTours'),
    'Multi-Day Tours': t('allTours.sectionMultiDay'),
    'Top Rated': t('allTours.sectionTopRated'),
    'Sell Out': t('allTours.sectionSellOut'),
    'Last Minute Deals': t('allTours.sectionSpecial'),
    'Top Attractions Nearby': t('allTours.sectionAttractions'),
    'New Experiences': t('allTours.sectionNew'),
  }), [t])

  const sortOptions = useMemo(() => [
    { value: 'recommended', label: t('allTours.sortPopular') },
    { value: 'near', label: t('allTours.sortClosest', { defaultValue: 'Closest' }) },
    { value: 'rating', label: t('allTours.sortPriceLow') },
    { value: 'popular', label: t('allTours.sortPriceHigh') },
    { value: 'price-low', label: t('allTours.sortPriceLow') },
    { value: 'price-high', label: t('allTours.sortPriceHigh') },
  ] as const, [t])

  // Unified listing query: the client sends the RAW query and the SERVER decides
  // whether it's a place (scope to it, with region fallback) or a plain text
  // search. One request — no resolve→listing waterfall, so there is no window in
  // which the page can render a placeholder scope.
  const { data: allToursData, isPending, isError, error } = useAllExpeditionTours({
    mood: moodParam,
    near: nearParam,
    q: placeParam,
  })
  const allTours = allToursData?.tours
  // Read scope fields straight off the hook result rather than via an
  // intermediate object binding — a local object reference is treated as
  // mutable by React Compiler, which then can't preserve this component's
  // manual memoization.
  //
  // When the backend widened the search to the place's region (the place itself
  // has no tours), the result is region-level, not place-level — rank by
  // popularity instead of place relevance and label it honestly.
  const fallbackRegion = allToursData?.placeScope?.fallbackRegion ?? null
  const placeValue = allToursData?.placeScope?.displayName || allToursData?.placeScope?.requested || placeParam
  // The region the place sits in (sent for both modes). Viewing a place-scoped
  // listing personalizes the homepage, so this is applied no matter which route
  // brought the user here — suggestion click, recent search, shared link, Back.
  const scopeRegion = allToursData?.placeScope?.region || fallbackRegion
  useEffect(() => {
    if (scopeRegion) setLocation(scopeRegion)
  }, [scopeRegion, setLocation])
  // Only a true in-place scope gets place ranking; region fallback and text
  // searches sort by popularity. Computed in the component body (not inside the
  // memo) so the memo's dependency list stays compiler-friendly.
  const isPlaceQuery = allToursData?.placeScope?.mode === 'place'
  const effectiveSortKey: SortKey =
    sortByVal === 'near'
      ? 'near'
      : sortByVal === 'recommended' && isPlaceQuery && !fallbackRegion
        ? 'place'
        : sortByVal === 'recommended' && nearParam
          ? 'near'
          : sortByVal === 'recommended' && sectionParam
            ? sectionSortKey(sectionParam)
            : sortByVal
  const { data: filterOptionData } = useTourFilterOptions()

  // Single lightweight call to get section tour IDs (reads pre-computed Redis cache)
  const { data: sectionTourIdList } = useSectionTourIds(sectionParam)
  const isOffersSection = sectionParam === 'Last Minute Deals'
  const { data: offerTours } = useHomepageOffers(50)
  const { data: sellOutTours } = useLikelySellOut(50)
  const offersMap = useMemo(() => {
    if (!offerTours?.length) return null
    const map = new Map<string, HomepageOfferTour>()
    for (const o of offerTours) map.set(o.id, o)
    return map
  }, [offerTours])

  // Id + normalized-title membership of the homepage sell-out list, so cards
  // carry the same "Likely to sell out" tag they get on the homepage (which
  // uses SellOutProvider around its sections).
  const sellOutSet = useMemo(() => {
    if (!sellOutTours?.length) return null
    const ids = new Set<string>()
    const titles = new Set<string>()
    for (const t of sellOutTours) {
      if (t.id) ids.add(t.id)
      if (t.title) titles.add(normalizeTitle(t.title))
    }
    return { ids, titles }
  }, [sellOutTours])

  const isSellOutTour = (tour: TourCardData): boolean => {
    if (sectionParam === 'Sell Out') return true
    if (!sellOutSet) return false
    if (tour.id && sellOutSet.ids.has(tour.id)) return true
    const title = normalizeTitle(tour.title)
    return !!title && sellOutSet.titles.has(title)
  }
  const sectionTourIds = useMemo(() => {
    if (!sectionTourIdList?.length) return null
    return new Set(sectionTourIdList)
  }, [sectionTourIdList])

  // Fetch tours for a specific attraction (when ?attraction= is set)
  const { data: attractionToursData, isLoading: isLoadingAttractionTours } = useAttractionTours(attractionParam, 50)
  const attractionTourIds = useMemo(() => {
    if (!attractionParam || !attractionToursData?.length) return null
    return new Set(attractionToursData.map(t => t.id))
  }, [attractionParam, attractionToursData])

  // True when an attraction search returned zero linked tours — the page should
  // show the "not quite there yet" empty state for the attraction, then fall
  // back to region-level tours below.
  const hasZeroAttractionTours = !!attractionParam
    && !isLoadingAttractionTours
    && attractionToursData !== undefined
    && attractionToursData.length === 0

  // Single "we don't know the result set yet" flag. `isPending` is react-query's
  // "no data for the current query key yet", which covers the first frame (before
  // the fetch starts) as well as the request itself — so the header can never
  // render a count or scope before the server has told us what it resolved to.
  // The attraction-tours fetch is included because the grid would otherwise show
  // the unfiltered place list before the attraction filter is known.
  const isBusy = isPending || (!!attractionParam && isLoadingAttractionTours)

  // Seed the destination filter from a /tours?location=... link (once per value).
  const seededLocationRef = useRef<string | null>(null)
  useEffect(() => {
    if (locationParam && seededLocationRef.current !== locationParam) {
      seededLocationRef.current = locationParam
      setDestinations(prev => prev.includes(locationParam) ? prev : [...prev, locationParam])
    }
  }, [locationParam])

  // Seed the category filter from a /tours?category=... link (e.g. from MoodSection).
  const seededCategoryRef = useRef<string | null>(null)
  useEffect(() => {
    if (categoryParam && seededCategoryRef.current !== categoryParam) {
      seededCategoryRef.current = categoryParam
      setCategories(prev => prev.includes(categoryParam) ? prev : [...prev, categoryParam])
    }
  }, [categoryParam])

  // Always start from page 1 whenever the active filters or sort change.
  useEffect(() => {
    window.setTimeout(() => setPage(1), 0)
  }, [tourTypes, destinations, categories, durationFilter, priceFilter, ratingFilter, sortBy])

  // React Compiler is enabled in this build and memoizes this automatically.
  // A manual useMemo it cannot preserve makes it skip the ENTIRE component
  // (react-hooks/preserve-manual-memoization), and its own analysis handles
  // deps a dep-array cannot express (e.g. `sortBy[0]` or hook-derived values).
  const filteredTours = (() => {
  let list = allTours || []

  if (tourTypes.length > 0) {
    list = list.filter((tour) => {
      const isMultiDay = (tour.durationMinutes ?? 0) >= 1440
      return tourTypes.includes(isMultiDay ? 'multi-day' : 'day')
    })
  }
  if (durationFilter.length > 0) {
    list = list.filter((tour) => {
      const mins = tour.durationMinutes
      if (mins == null || mins <= 0) return false
      return durationFilter.some(value => DURATION_BUCKETS.find(b => b.value === value)?.match(mins))
    })
  }
  if (priceFilter.length > 0) {
    list = list.filter((tour) => {
      const price = tour.priceValue
      if (price == null) return false
      return priceFilter.some(value => PRICE_RANGES.find(r => r.value === value)?.match(price))
    })
  }
  if (ratingFilter.length > 0) {
    const minRating = Math.min(...ratingFilter.map(Number))
    list = list.filter((tour) => (tour.ratingValue ?? 0) >= minRating)
  }
  if (categories.length > 0) {
    list = list.filter((tour) => categories.some(c => c.toLowerCase() === tour.category?.toLowerCase()))
  }
  if (destinations.length > 0) {
    list = list.filter((tour) => {
      const locLower = tour.location.toLowerCase()
      return destinations.some((d) => {
        const dl = d.toLowerCase()
        return locLower === dl || locLower.startsWith(`${dl},`) || locLower.includes(`, ${dl}`)
      })
    })
  }

  // Filter by section algorithm (tours curated by the homepage backend)
  if (sectionTourIds) {
    list = list.filter(tour => sectionTourIds.has(tour.id))
  }

  // Filter by attraction (tours that visit a specific attraction)
  if (attractionTourIds) {
    list = list.filter(tour => attractionTourIds.has(tour.id))
  }

  return applySort(list, effectiveSortKey, nearParam)
  })()

  const totalCount = filteredTours.length
  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE))
  const hasNextPage = page < totalPages
  const hasPrevPage = page > 1

  // Cheap slice — no manual memo (React Compiler memoizes it, and a manual one
  // it can't preserve makes it skip the whole component).
  const displayTours = filteredTours.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

  const filterOptions = useMemo(() => {
    const optionDestinations = [...(filterOptionData?.destinations || [])]
    if (locationParam && !optionDestinations.some(d => d.toLowerCase() === locationParam.toLowerCase())) {
      optionDestinations.push(locationParam)
    }
    return {
      destinations: optionDestinations.map(v => ({ value: v, label: v })),
      categories: (filterOptionData?.categories || []).map(v => ({ value: v, label: v })),
    }
  }, [filterOptionData, locationParam])

  const allPillOptions = useMemo(() => {
    const pills: { key: string; value: string; label: string }[] = []
    TOUR_TYPE_OPTIONS.forEach(o => pills.push({ key: `type-${o.value}`, value: o.value, label: o.label }))
    DURATION_BUCKETS.forEach(b => pills.push({ key: `dur-${b.value}`, value: b.value, label: b.label }))
    PRICE_RANGES.forEach(r => pills.push({ key: `price-${r.value}`, value: r.value, label: r.label }))
    filterOptions.destinations.forEach(d => pills.push({ key: `dest-${d.value}`, value: d.value, label: d.label }))
    filterOptions.categories.forEach(c => pills.push({ key: `cat-${c.value}`, value: c.value, label: c.label }))
    RATING_OPTIONS.forEach(r => pills.push({ key: `rating-${r.value}`, value: r.value, label: r.label }))
    return pills
  }, [filterOptions, TOUR_TYPE_OPTIONS, DURATION_BUCKETS, PRICE_RANGES])

  const isPillActive = (value: string) => {
    return tourTypes.includes(value) || destinations.includes(value) ||
      categories.includes(value) || durationFilter.includes(value) || priceFilter.includes(value) ||
      ratingFilter.includes(value)
  }

  const handlePillToggle = (value: string) => {
    if (TOUR_TYPE_OPTIONS.some(o => o.value === value)) { handleMulti(setTourTypes)(value); return }
    if (DURATION_BUCKETS.some(b => b.value === value)) { handleMulti(setDurationFilter)(value); return }
    if (PRICE_RANGES.some(r => r.value === value)) { handleMulti(setPriceFilter)(value); return }
    if (RATING_OPTIONS.some(r => r.value === value)) { handleMulti(setRatingFilter)(value); return }
    if (filterOptions.destinations.some(d => d.value === value)) { handleMulti(setDestinations)(value); return }
    if (filterOptions.categories.some(c => c.value === value)) { handleMulti(setCategories)(value); return }
  }

  const baseTitle = attractionParam
    ? hasZeroAttractionTours
      ? t('sections.toursIn', { location: placeValue || placeParam || attractionParam })
      : attractionParam
    : placeParam
    ? fallbackRegion
      ? t('sections.toursInRegion', { region: fallbackRegion })
      : t('sections.toursIn', { location: placeValue || placeParam })
    : moodParam
    ? moodParam
    : locationParam
    ? t('sections.toursIn', { location: locationParam })
    : SECTION_TITLES[sectionParam] || t('allTours.pageTitle')

  // When arriving "near {city}", surface it in the heading.
  const pageTitle = nearParam
    ? t('allTours.nearLocation', { title: baseTitle, location: nearParam, defaultValue: '{{title}} near {{location}}' })
    : baseTitle

  const handleMulti = (setter: React.Dispatch<React.SetStateAction<string[]>>) =>
    (value: string) => setter(prev => prev.includes(value) ? prev.filter(v => v !== value) : [...prev, value])

  const handleSingle = (setter: React.Dispatch<React.SetStateAction<string[]>>) =>
    (value: string) => setter(prev => prev[0] === value ? [] : [value])

  const clearAll = () => {
    setTourTypes([]); setDestinations([]); setCategories([])
    setDurationFilter([]); setPriceFilter([]); setRatingFilter([])
    setSortBy(['recommended']); setPage(1)
  }

  const activeFilterCount = tourTypes.length + destinations.length + categories.length +
    durationFilter.length + priceFilter.length + ratingFilter.length

  const scrollRef = useRef<HTMLDivElement>(null)
  const [showLeftArrow, setShowLeftArrow] = useState(false)
  const [showRightArrow, setShowRightArrow] = useState(true)

  const updateArrows = useCallback(() => {
    const el = scrollRef.current
    if (!el) return
    const eps = 4
    setShowLeftArrow(el.scrollLeft > eps)
    setShowRightArrow(el.scrollLeft < el.scrollWidth - el.clientWidth - eps)
  }, [])

  const handleScroll = useCallback(() => updateArrows(), [updateArrows])

  const goNextPage = () => {
    if (hasNextPage) setPage(p => p + 1)
  }

  const goPrevPage = () => {
    if (hasPrevPage) setPage(p => Math.max(1, p - 1))
  }

  // Real back navigation when the user arrived from within the app; otherwise
  // (direct link / new tab, where there is no in-app history) go to the
  // homepage so the button is never a dead end.
  const handleBack = useCallback(() => {
    const idx = typeof window !== 'undefined' ? (window.history.state?.idx ?? 0) : 0
    if (idx > 0) navigate(-1)
    else navigate('/')
  }, [navigate])

  const seoTitle = fallbackRegion
    ? `Tours in ${fallbackRegion}`
    : placeParam
    ? `Tours in ${placeParam} | Ghana Tours & Experiences`
    : 'Ghana Tours & Experiences | Book Authentic African Adventures'

  const seoDescription = placeParam
    ? `Discover ${totalCount || 'the best'} tours and experiences in ${placeParam}, Ghana. Book cultural tours, food tours, wildlife safaris, and adventure activities. Free cancellation, best prices guaranteed.`
    : 'Explore authentic Ghana tours and experiences. Book cultural tours, wildlife safaris, food tours, and adventure activities across Accra, Cape Coast, Volta Region, and more. Free cancellation.'

  const seoKeywords = placeParam
    ? `${placeParam} tours, things to do in ${placeParam}, ${placeParam} Ghana, ${placeParam} activities, ${placeParam} experiences, Ghana tours, book tours in ${placeParam}`
    : 'Ghana tours, things to do in Ghana, Ghana experiences, Accra tours, Cape Coast tours, Ghana safari, Ghana food tour, Ghana cultural tour, West Africa tours'

  return (
    <div className="all-tours-page">
      <SEO
        title={seoTitle}
        description={seoDescription}
        keywords={seoKeywords}
        // Mirrors the prerendered copy: ?place= is self-canonical (SEO.tsx
        // keeps the param), and a place with no tours stays served but out of
        // the index so an invented town cannot mint a duplicate of /tours.
        robots={
          placeParam && !isPending && (allTours?.length ?? 0) === 0
            ? 'noindex, follow'
            : undefined
        }
        jsonLd={[
          buildBreadcrumbSchema([
            { name: 'Home', url: 'https://www.travioghana.com/' },
            ...(placeParam
              ? [{ name: placeParam, url: `https://www.travioghana.com/tours?place=${encodeURIComponent(placeParam)}` }]
              : []),
            { name: 'Tours', url: 'https://www.travioghana.com/tours' },
          ]),
          ...(filteredTours.length > 0 ? [buildItemListSchema(
            filteredTours.slice(0, 20).map((t: TourCardData) => ({
              name: t.title,
              url: `https://www.travioghana.com/tour/${encodeURIComponent(t.id)}/${encodeURIComponent(t.slug)}`,
              image: t.image || undefined,
            }))
          )] : []),
        ]}
      />
      <div className="all-tours-container">
        <div className="all-tours-header">
          <div className="all-tours-header-left">
            <div>
              {isBusy ? (
                <div className="all-tours-title-skeleton" aria-hidden="true" />
              ) : (
                <h1 className="all-tours-title">{pageTitle}</h1>
              )}
              {isBusy ? (
                <p className="all-tours-count">{t('allTours.loading')}</p>
              ) : (
                <p className="all-tours-count">
                  {totalCount === 1
                    ? t('allTours.tourFound', { count: totalCount })
                    : t('allTours.toursFound', { count: totalCount })}
                </p>
              )}
              <button
                type="button"
                className="all-tours-back-inline"
                onClick={handleBack}
                aria-label={t('allTours.back', { defaultValue: 'Go back' })}
              >
                <ArrowLeft size={16} aria-hidden="true" />
                <span>{t('allTours.back', { defaultValue: 'Back' })}</span>
              </button>
            </div>
          </div>
          {activeFilterCount > 0 && (
            <button className="all-tours-clear" onClick={clearAll}>{t('allTours.clearFilters')}</button>
          )}
        </div>

        {!isBusy && !isError && fallbackRegion && (
          <div className="all-tours-region-fallback" role="status" aria-live="polite">
            <MapPin size={16} className="all-tours-region-fallback-icon" aria-hidden="true" />
            <span>
              {t('allTours.regionFallbackNotice', {
                location: allToursData?.placeScope?.requested || placeParam,
                region: fallbackRegion,
                defaultValue: "We don't have tours in {{location}} yet, but here are experiences across {{region}}.",
              })}
            </span>
          </div>
        )}

        <div className="filter-bar-sticky">
          <div className="filter-bar">
            <button className="filter-drawer-btn" onClick={() => setDrawerOpen(true)}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: 6, flexShrink: 0 }}>
                <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" />
              </svg>
              {t('allTours.filters')}
              {activeFilterCount > 0 && <span className="filter-count-badge">{activeFilterCount}</span>}
            </button>

            <button
              type="button"
              className={`filter-arrow left ${showLeftArrow ? 'visible' : ''}`}
              onClick={() => { const el = scrollRef.current; if (el) el.scrollBy({ left: -300, behavior: 'smooth' }) }}
              aria-label="Scroll filters left"
            >
              <ChevronLeft size={20} />
            </button>

            <div ref={scrollRef} className="filter-pills-scroll" onScroll={handleScroll}>
              {sectionParam && (
                <button
                  type="button"
                  className="filter-pill active"
                  onClick={() => navigate('/tours')}
                >
                  {SECTION_TITLES[sectionParam] || sectionParam}
                  <X size={12} className="filter-pill-x" />
                </button>
              )}
              {moodParam && (
                <button
                  type="button"
                  className="filter-pill active"
                  onClick={() => navigate('/tours')}
                >
                  {moodParam}
                  <X size={12} className="filter-pill-x" />
                </button>
              )}
              {attractionParam && (
                <button
                  type="button"
                  className="filter-pill active"
                  onClick={() => navigate('/tours')}
                >
                  {attractionParam}
                  <X size={12} className="filter-pill-x" />
                </button>
              )}
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

            <button
              type="button"
              className={`filter-arrow right ${showRightArrow ? 'visible' : ''}`}
              onClick={() => { const el = scrollRef.current; if (el) el.scrollBy({ left: 300, behavior: 'smooth' }) }}
              aria-label="Scroll filters right"
            >
              <ChevronRight size={20} />
            </button>
          </div>
        </div>

        {/* Attraction with zero linked tours. If the region fallback produced
            tours, just show those under the normal heading — an empty-state hero
            there reads as "this region has nothing" while listing its tours. */}
        {!isBusy && !isError && hasZeroAttractionTours && displayTours.length === 0 && (
          <NoToursEmptyState
            location={placeValue || placeParam}
            attraction={attractionParam}
            region={placeValue || placeParam}
            onBrowseAll={() => navigate('/tours')}
          />
        )}

        {isBusy && displayTours.length === 0 && (
          <div className="all-tours-grid">
            {Array.from({ length: PAGE_SIZE }).map((_, i) => (
              <TourCardSkeleton key={i} />
            ))}
          </div>
        )}

        {isError && (
          <div className="all-tours-empty">
            <h3>{t('allTours.failedToLoad')}</h3>
            <p>{(error as Error)?.message || t('allTours.tryAgain')}</p>
          </div>
        )}

        {!isBusy && !isError && (
          <div className="all-tours-grid">
            <AnimatePresence mode="popLayout">
              {displayTours.map((tour) => (
                <motion.div
                  key={tour.slug || tour.title}
                  layout
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.9 }}
                  transition={{ duration: 0.25 }}
                >
                    <TourCard
                      id={tour.id}
                      title={tour.title}
                      category={tour.category}
                      duration={tour.duration}
                      features={tour.features}
                      price={tour.price}
                      rating={tour.rating}
                      reviews={tour.reviews}
                      location={tour.location}
                      image={tour.image}
                      photos={tour.photos}
                      source={tour.source}
                      externalUrl={tour.externalUrl}
                      slug={tour.slug}
                      difficulty={tour.difficulty}
                      cancellationPolicy={tour.cancellationPolicy}
                      pickupIncluded={tour.pickupIncluded}
                      meetingMode={tour.meetingMode}
                      languages={tour.languages}
                      discount={offersMap?.get(tour.id) ? computeDiscountLabel(offersMap.get(tour.id)!) : undefined}
                      specialOffers={offersMap?.get(tour.id)?.specialOffers}
                      hideOfferBadge={isOffersSection}
                      likelyToSellOut={isSellOutTour(tour)}
                      imageClean
                      hideFeatures
                      compactDurationOnMobile
                      bodyOfferBadgesOnMobile
                      openInNewTab
                    />
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        )}

        {!isBusy && !isError && !hasZeroAttractionTours && displayTours.length === 0 && (
          <NoToursEmptyState
            location={placeParam || nearParam || locationParam || currentLocation || ''}
            onBrowseAll={() => navigate('/tours')}
          />
        )}

        {!isBusy && (hasNextPage || hasPrevPage) && (
          <div className="all-tours-load-more">
            <div className="pagination-controls">
              <button
                className="all-tours-load-btn"
                onClick={goPrevPage}
                disabled={!hasPrevPage}
                style={{ opacity: hasPrevPage ? 1 : 0.4 }}
              >
                <ChevronLeft size={14} />
                {t('allTours.prev')}
              </button>
              <span className="pagination-indicator">
                {t('allTours.pageOf', { page, total: totalPages })}
              </span>
              <button
                className="all-tours-load-btn"
                onClick={goNextPage}
                disabled={!hasNextPage}
                style={{ opacity: hasNextPage ? 1 : 0.4 }}
              >
                {t('allTours.next')}
                <ChevronRight size={14} />
              </button>
            </div>
          </div>
        )}
      </div>

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
                <h2 className="filter-drawer-title">{t('allTours.filters')}</h2>
                <button type="button" className="filter-drawer-close" onClick={() => setDrawerOpen(false)}>
                  <X size={18} />
                </button>
              </div>
              {activeFilterCount > 0 && (
                <button className="filter-drawer-clear" onClick={() => { clearAll(); }}>
                  {t('allTours.clearFilters')} ({activeFilterCount})
                </button>
              )}

              <div className="filter-drawer-sections">
                <FilterSection title={t('common.rating')} options={[...RATING_OPTIONS]} selected={ratingFilter} onChange={handleMulti(setRatingFilter)} renderLabel={(opt) => (
                  <span className="filter-rating-label">
                    <span className="filter-rating-number">{opt.label}</span>
                    {Array.from({ length: Number(opt.value) }, (_, i) => (
                      <Star key={i} size={14} className="filter-star-icon" />
                    ))}
                  </span>
                )} />
                <FilterSection title={t('allTours.filterType')} options={[...TOUR_TYPE_OPTIONS]} selected={tourTypes} onChange={handleMulti(setTourTypes)} />
                <FilterSection title={t('allTours.filterPrice')} options={PRICE_RANGES.map(r => ({ value: r.value, label: r.label }))} selected={priceFilter} onChange={handleMulti(setPriceFilter)} />
                <FilterSection title={t('allTours.filterCategory')} options={filterOptions.categories} selected={categories} onChange={handleMulti(setCategories)} />
                <FilterSection title={t('allTours.filterSort')} options={[...sortOptions]} selected={sortBy} onChange={handleSingle(setSortBy)} single />
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  )
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
