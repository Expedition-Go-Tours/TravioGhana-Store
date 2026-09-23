import { useQuery } from '@tanstack/react-query'
import { fetchWithAuth } from '../lib/api'

export interface RecommendedTour {
  id: string
  title: string
  slug: string
  description?: string | null
  coverPhoto?: string | null
  photos?: string[]
  category?: string | null
  durationMinutes?: number | null
  averageRating?: number | null
  reviewCount?: number | null
  city?: string | null
  country?: string | null
  startingPrice?: number | null
  currency?: string | null
  supplierName?: string | null
  specialOffers?: {
    id: string
    name: string
    offerType: string
    discountType?: string | null
    discountPercentage?: number | null
  }[]
  isNew?: boolean
  likelyToSellOut?: boolean
}

interface RecommendedToursResponse {
  status: string
  data: {
    location: string
    tours: { id: string; tour: RecommendedTour }[]
  }
}

async function fetchRecommendedTours(tourId: string, limit = 6): Promise<RecommendedToursResponse> {
  const params = new URLSearchParams({ tourId, limit: String(limit) })
  const res = await fetchWithAuth(`/travioghana/tours/recommended?${params}`)
  if (!res.ok) {
    const payload = await res.json().catch(() => ({}))
    throw new Error(payload.message || `Request failed (${res.status})}`)
  }
  return res.json()
}

export function useRecommendedTours(tourId: string | undefined, limit = 6) {
  return useQuery({
    queryKey: ['recommended-tours', tourId, limit],
    queryFn: () => fetchRecommendedTours(tourId!, limit),
    enabled: !!tourId,
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
  })
}
