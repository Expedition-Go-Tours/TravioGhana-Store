import { useQuery } from '@tanstack/react-query'
import { fetchTourTrust, type TourTrust } from '../lib/storefrontExtras'

/**
 * Trust facts next to the price: verified review count and how many people
 * booked this tour in the last week.
 *
 * The backend returns null for any stat below its sample size, and this hook
 * treats a failed request as "no trust facts" rather than an error — the tour
 * page must render whether or not the decoration loaded.
 */
export function useTourTrust(tourId: string | undefined) {
  return useQuery<TourTrust | null>({
    queryKey: ['tour-trust', tourId],
    queryFn: () => fetchTourTrust(tourId!),
    enabled: !!tourId,
    staleTime: 10 * 60 * 1000,
    gcTime: 15 * 60 * 1000,
    retry: 1,
  })
}
