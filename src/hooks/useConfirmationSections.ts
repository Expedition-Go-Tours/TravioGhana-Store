import { useQuery } from '@tanstack/react-query'
import { fetchWithAuth } from '../lib/api'
import { useSimilarTours, type TourCardData } from './useExpeditionTours'
import { useHomepageOffers, mapToTourCard, type HomepageOfferTour } from './useHomepageSections'

/* ── Supplier tours (new backend endpoint) ──────────────────────────── */

interface SupplierTourRecord {
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
    id: r.id,
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

function useSupplierTours(supplierId?: string, excludeTourId?: string, limit = 8) {
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
      const records: SupplierTourRecord[] = payload.data?.tours ?? []
      return records.map(mapSupplierTourToCard)
    },
    staleTime: 5 * 60_000,
  })
}

/* ── Exported hook ──────────────────────────────────────────────────── */

export function useConfirmationSections(
  tourSlug?: string,
  supplierId?: string,
  excludeTourId?: string,
) {
  const supplierQuery = useSupplierTours(supplierId, excludeTourId, 8)
  const similarQuery = useSimilarTours(tourSlug)
  const offersQuery = useHomepageOffers(12)

  const offers: TourCardData[] = (offersQuery.data ?? []).map((t: HomepageOfferTour) =>
    mapToTourCard(t)
  )

  return {
    supplierTours: supplierQuery.data ?? [],
    similarTours: similarQuery.data ?? [],
    offers,
    isLoading:
      supplierQuery.isLoading ||
      similarQuery.isLoading ||
      offersQuery.isLoading,
    supplierToursReady: supplierQuery.isSuccess,
    similarToursReady: similarQuery.isSuccess,
    offersReady: offersQuery.isSuccess,
  }
}
