import { useQuery } from '@tanstack/react-query'
import { apiFetch } from '../lib/api'

interface ToursCountEnvelope {
  pagination?: { totalCount?: number }
}

/**
 * The supplier's total active tour count.
 *
 * The tour payload itself carries no tour count, so the tour-detail Supplier
 * tab used to display `relatedTours.length` — the size of the "similar
 * experiences" row. The same supplier therefore read "4 tours" on a tour page
 * and "31 tours" on /supplier/<name>, which fetches the real catalogue.
 *
 * `/tours` reports the authoritative total in `pagination.totalCount`, so ask
 * for a single row (limit=1) and read that instead of pulling the catalogue.
 */
export function useSupplierTourCount(supplierId: string | null | undefined) {
  return useQuery({
    queryKey: ['supplier', 'tourCount', supplierId],
    enabled: !!supplierId,
    queryFn: async (): Promise<number> => {
      const payload = await apiFetch<ToursCountEnvelope>(
        `/tours?supplierId=${encodeURIComponent(supplierId!)}&limit=1`,
      )
      return payload?.pagination?.totalCount ?? 0
    },
    staleTime: 5 * 60_000,
  })
}
