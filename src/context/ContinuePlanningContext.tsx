import { createContext, useContext, useState, useEffect, useCallback, useRef, type ReactNode } from 'react'
import type { Tour, MultiDayTour } from '../components/data'
import type { SpecialOfferData } from '../hooks/useExpeditionTours'
import { readGated, writeGated, removeGated } from '../lib/consentGatedStorage'

export interface ContinuePlanningItem {
  id: string
  /**
   * Real backend tour ID. Present when the item was captured from a live tour
   * (any API-sourced tour). Legacy/static items captured before this field
   * existed don't have it — those fall back to the slug-only `/tour/{slug}`
   * URL, which the API resolves.
   */
  tourId?: string
  title: string
  location: string
  price: number
  duration: string
  features: string
  imageUrl: string
  /** All tour photos — drives the swipeable image carousel on mobile cards. */
  photos?: string[]
  rating: number
  reviewCount: number
  viewedAt: string
  /** Tour-card fields so the Continue Planning carousel can render full cards. */
  category?: string
  /** Operator of the tour — scopes scraped TripAdvisor / GetYourGuide stats. */
  supplierName?: string | null
  languages?: string[]
  difficulty?: string
  cancellationPolicy?: string
  pickupIncluded?: boolean
  meetingMode?: 'meeting_point' | 'pickup' | 'none'
  source?: 'expedition-go' | 'travio-africa'
  externalUrl?: string
  slug?: string
  discount?: string
  specialOffers?: SpecialOfferData[]
}

interface ContinuePlanningContextValue {
  continuePlanning: ContinuePlanningItem[]
  addToContinuePlanning: (item: ContinuePlanningItem) => void
  removeFromContinuePlanning: (id: string) => void
  clearContinuePlanning: () => void
  isInContinuePlanning: (id: string) => boolean
  continuePlanningCount: number
}

const ContinuePlanningContext = createContext<ContinuePlanningContextValue | null>(null)

function generateId(title: string, location: string): string {
  return btoa(`${title}|${location}`).replace(/=/g, '')
}

 
export function toContinuePlanningItem(tour: Tour | (MultiDayTour & { days?: string })): ContinuePlanningItem {
  const m = tour as MultiDayTour & { days?: string }
  const hasDuration = 'duration' in tour && typeof tour.duration === 'string'
  const hasDays = 'days' in m && typeof m.days === 'string'
  // The backend id is the tour's real identity. Only when it is missing (static
  // mock cards) fall back to the title/location hash — a legacy synthetic id
  // that the API cannot resolve, kept solely so old entries still render.
  const realId = (tour as { id?: string }).id

  const tourFeatures = 'features' in tour && typeof (tour as Tour).features === 'string'
    ? (tour as Tour).features
    : ('highlights' in m && typeof m.highlights === 'string' ? m.highlights : '')

  return {
    id: realId || generateId(tour.title, tour.location),
    tourId: realId || undefined,
    title: tour.title,
    location: tour.location,
    price: parseInt(tour.price.replace(/[$,]/g, '')) || 0,
    duration: hasDuration ? (tour as Tour).duration : (hasDays ? m.days : '1 Day'),
    features: tourFeatures,
    imageUrl: tour.image,
    photos: (tour as Tour).photos,
    rating: parseFloat(tour.rating) || 0,
    reviewCount: tour.reviews,
    viewedAt: new Date().toISOString(),
    category: (tour as Tour).category,
    languages: (tour as Tour).languages,
    difficulty: (tour as Tour).difficulty,
    cancellationPolicy: (tour as Tour).cancellationPolicy,
    pickupIncluded: (tour as Tour).pickupIncluded,
    meetingMode: (tour as Tour).meetingMode,
    source: (tour as Tour).source,
    externalUrl: (tour as Tour).externalUrl,
    supplierName: (tour as Tour).supplierName,
    slug: (tour as Tour & { slug?: string }).slug,
    discount: (tour as Tour).discount,
    specialOffers: (tour as Tour & { specialOffers?: SpecialOfferData[] }).specialOffers,
  }
}

const STORAGE_KEY = 'expedition_go_continue_planning'
const MAX_ITEMS = 12

/**
 * Stable identity used to de-duplicate the list. Prefers the slug: legacy
 * entries stored before `tourId` existed carry the old `btoa(title|location)`
 * id but the same slug, so re-viewing a tour upgrades its entry in place
 * instead of duplicating it (or, with the old hash id, evicting a different
 * tour that happened to share the same title + location).
 */
function itemIdentity(item: ContinuePlanningItem): string {
  return item.slug || item.tourId || item.id
}

function loadStorage(): ContinuePlanningItem[] {
  try {
    const stored = readGated(STORAGE_KEY)
    return stored ? JSON.parse(stored) : []
  } catch {
    return []
  }
}

export function ContinuePlanningProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ContinuePlanningItem[]>(loadStorage)
  const itemsRef = useRef(items)

  useEffect(() => {
    itemsRef.current = items
    writeGated(STORAGE_KEY, JSON.stringify(items))
  }, [items])

  const addToContinuePlanning = useCallback((item: ContinuePlanningItem) => {
    setItems(prev => {
      const identity = itemIdentity(item)
      const filtered = prev.filter(i => itemIdentity(i) !== identity)
      return [{ ...item, viewedAt: new Date().toISOString() }, ...filtered].slice(0, MAX_ITEMS)
    })
  }, [])

  const removeFromContinuePlanning = useCallback((id: string) => {
    setItems(prev => prev.filter(i => i.id !== id))
  }, [])

  const clearContinuePlanning = useCallback(() => {
    setItems([])
    removeGated(STORAGE_KEY)
  }, [])

  const isInContinuePlanning = useCallback((id: string) => {
    return itemsRef.current.some(i => i.id === id)
  }, [])

  return (
    <ContinuePlanningContext.Provider
      value={{
        continuePlanning: items,
        addToContinuePlanning,
        removeFromContinuePlanning,
        clearContinuePlanning,
        isInContinuePlanning,
        continuePlanningCount: items.length,
      }}
    >
      {children}
    </ContinuePlanningContext.Provider>
  )
}

 
export function useContinuePlanning(): ContinuePlanningContextValue {
  const ctx = useContext(ContinuePlanningContext)
  if (!ctx) throw new Error('useContinuePlanning must be used within a ContinuePlanningProvider')
  return ctx
}
