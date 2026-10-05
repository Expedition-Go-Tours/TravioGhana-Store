import { useQuery } from '@tanstack/react-query'
import { fetchWithAuth } from '../lib/api'
import type { TourCardData } from './useExpeditionTours'

/**
 * A supplier's own active tours, for a "more from this supplier" card rail.
 *
 * Backed by the public supplier-scoped storefront endpoint, which is
 * deliberately stricter than the generic `/tours?supplierId=…` listing: it
 * returns only tours whose listing is active, whose own status is ACTIVE and
 * whose supplier profile is ACTIVE, ordered best-rated first and cached for
 * 10 minutes server-side.
 *
 * `excludeTourId` drops the tour the reader is already on. That matters on the
 * tour-detail page, where the rail sits directly beneath the current tour, and
 * on the booking confirmation, which shows the supplier's row *after* that
 * booking was just taken.
 */

interface SupplierTourRecord {
  /**
   * The storefront **listing** row id, not a Tour id. Deliberately unused —
   * see the note in `mapSupplierTourToCard`.
   */
  id: string
  tour: {
    id: string
    title: string
    slug: string
    description?: string | null
    coverPhoto?: string | null
    photos?: string[]
    category?: string | null
    durationMinutes?: number | null
    averageRating?: number | null
    reviewCount?: number
    city?: string | null
    country?: string | null
    tags?: string[]
    startingPrice?: number | null
    currency?: string
    totalBookings?: number
    supplier?: { id?: string; name?: string | null; photoURL?: string | null }
  }
}

function mapSupplierTourToCard(r: SupplierTourRecord): TourCardData {
  const t = r.tour
  const durationStr = t.durationMinutes
    ? t.durationMinutes >= 1440
      ? `${Math.round(t.durationMinutes / 1440)} days`
      : `${Math.round(t.durationMinutes / 60)} hours`
    : ''
  const location = [t.city, t.country].filter(Boolean).join(', ')
  return {
    // The card's `id` is not decoration: TourCard builds the canonical
    // `/tour/{id}/{slug}` URL from it, and the public tour endpoint resolves
    // the first segment as a Tour id or a slug. A storefront listing row id
    // is neither, so mapping `r.id` here made every card in this rail a 404 —
    // silently, because the slug in the same URL was never consulted as a
    // fallback. The Tour's own id is the stable identity the rest of the
    // storefront already links with.
    id: t.id,
    title: t.title || '',
    slug: t.slug || '',
    category: t.category || '',
    duration: durationStr,
    features: t.tags?.join(', ') || '',
    price: t.startingPrice != null ? `$${t.startingPrice}` : '',
    rating: t.averageRating != null ? String(t.averageRating) : '',
    reviews: t.reviewCount || 0,
    location,
    image: t.coverPhoto || t.photos?.[0] || '',
    photos: t.photos,
    source: 'expedition-go',
    priceValue: t.startingPrice,
  }
}

/**
 * @param limit Rows to fetch. The endpoint caps this at 20.
 */
export function useSupplierTours(
  supplierId?: string | null,
  excludeTourId?: string | null,
  limit = 8,
) {
  return useQuery({
    queryKey: ['expedition', 'supplier-tours', supplierId, excludeTourId, limit],
    enabled: !!supplierId,
    queryFn: async () => {
      const params = new URLSearchParams({ limit: String(limit) })
      if (excludeTourId) params.set('exclude', excludeTourId)
      const res = await fetchWithAuth(
        `/travioghana/suppliers/${encodeURIComponent(supplierId!)}/tours?${params}`
      )
      const payload = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(payload.message || `Request failed (${res.status})`)
      // The endpoint answers `{ status, data: { tours } }`. Accept a bare array
      // too so a future shape change degrades to "rail empty" rather than a
      // thrown TypeError inside the query.
      const records: SupplierTourRecord[] = Array.isArray(payload)
        ? payload
        : (payload.data?.tours ?? [])
      return records.map(mapSupplierTourToCard)
    },
    staleTime: 5 * 60_000,
  })
}