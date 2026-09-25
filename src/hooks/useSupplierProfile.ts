import { useQuery } from '@tanstack/react-query'
import { apiFetch } from '../lib/api'
import { mapRawTourToListing, type TourCardData } from './useExpeditionTours'
import { resolveSupplierProfileTour, type SupplierIdentity } from '../lib/supplierResolution'
import type { RawSupplierTour } from '../lib/supplierProfile'

/** Page size for a supplier's tour catalogue. */
const TOURS_PAGE_SIZE = 100
/** Ceiling on catalogue pages fetched in one go, so a runaway supplier can't hang the page. */
const MAX_TOUR_PAGES = 10

/**
 * Resolves the supplier's full profile block. Prefers the exact tour id (passed
 * in router state by the "View more" link), then a supplier id, then a
 * catalogue scan by name — so a refresh or a shared link lands on the same data
 * as the click-through.
 *
 * 60s staleTime mirrors the API's `max-age=60` on /tours/:id: the supplier's
 * account-page edits show up on the next visit instead of waiting out a
 * five-minute client cache.
 */
export function useSupplierProfile(identity: SupplierIdentity) {
  const key = identity.tourId || identity.supplierId || identity.name || ''
  return useQuery({
    queryKey: ['supplier', 'profile', key],
    enabled: !!key,
    queryFn: () => resolveSupplierProfileTour(identity),
    staleTime: 60_000,
  })
}

export interface SupplierToursResult {
  tours: TourCardData[]
  /** Authoritative total from `pagination.totalCount` — never the fetched array length. */
  totalCount: number | null
}

interface ToursEnvelope {
  tours?: RawSupplierTour[]
  pagination?: { totalCount?: number; hasNextPage?: boolean } | null
}

/**
 * Every active tour belonging to a supplier, fetched by supplier id.
 *
 * Walks the pages until the API stops offering more (bounded by MAX_TOUR_PAGES)
 * and reports the server's `totalCount`, because counting the first page made
 * the header report "100 tours" for any supplier with a longer catalogue and
 * left the rest unreachable behind the "View all" button.
 */
export function useSupplierTours(supplierId: string | null) {
  return useQuery({
    queryKey: ['supplier', 'tours', supplierId],
    enabled: !!supplierId,
    queryFn: async (): Promise<SupplierToursResult> => {
      const tours: TourCardData[] = []
      let totalCount: number | null = null

      for (let page = 1; page <= MAX_TOUR_PAGES; page += 1) {
        const payload: ToursEnvelope = await apiFetch(
          `/tours?supplierId=${encodeURIComponent(supplierId!)}&limit=${TOURS_PAGE_SIZE}&page=${page}`,
        )
        const batch = Array.isArray(payload?.tours) ? payload.tours : []
        totalCount = payload?.pagination?.totalCount ?? totalCount
        tours.push(...batch.map(mapRawTourToListing))
        if (!batch.length || !payload?.pagination?.hasNextPage) break
      }

      return { tours, totalCount }
    },
    staleTime: 60_000,
  })
}
