import { useSimilarTours, type TourCardData } from './useExpeditionTours'
import { useHomepageOffers, mapToTourCard, type HomepageOfferTour } from './useHomepageSections'
import { useSupplierTours } from './useSupplierTours'

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
