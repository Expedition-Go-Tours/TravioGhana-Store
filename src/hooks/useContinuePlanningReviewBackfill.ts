import { useEffect, useRef } from 'react'
import { apiFetch } from '../lib/api'
import type { ContinuePlanningItem } from '../context/ContinuePlanningContext'

type ContinuePlanningPatch = Partial<Omit<ContinuePlanningItem, 'id'>>
type UpdateContinuePlanningItem = (id: string, patch: ContinuePlanningPatch) => void

interface CuratedTour {
  id?: string
  slug?: string
  title?: string
  supplierName?: string | null
  supplier?: { name?: string | null } | null
  city?: string | null
  country?: string | null
}

interface CuratedTourPayload {
  tour?: CuratedTour & { tour?: CuratedTour }
}

/**
 * Unwrap the two API shapes the lookup can return:
 *  - curated detail: { data: { tour: { tour: { ... } } } }
 *  - raw detail:     { data: { tour: { ... } } }
 */
function unwrapTour(payload: CuratedTourPayload | null | undefined): CuratedTour | null {
  const wrapper = payload?.tour ?? (payload as CuratedTour | null | undefined)
  const tour = (wrapper as { tour?: CuratedTour } | null | undefined)?.tour ?? wrapper
  return tour && typeof tour === 'object' ? tour : null
}

/**
 * Repairs snapshots saved before `supplierName` was captured on the tour
 * detail page.
 *
 * Continue Planning cards combine the stored in-app review count with the
 * scraped TripAdvisor/GetYourGuide totals. That matcher deliberately fails
 * closed when it cannot prove the tour belongs to the scraped operator, so a
 * missing supplier name left the card showing the raw in-app count — usually 0.
 *
 * Only items that are missing the supplier and still have a real tour id/slug
 * are looked up. Each id is attempted once per mount, and a failed lookup
 * leaves the snapshot untouched rather than looping.
 */
export function useContinuePlanningReviewBackfill(
  items: ContinuePlanningItem[],
  updateItem?: UpdateContinuePlanningItem,
) {
  const attempted = useRef(new Set<string>())

  useEffect(() => {
    if (!updateItem) return

    for (const item of items) {
      if (item.supplierName) continue
      const key = item.tourId || item.slug
      if (!key || attempted.current.has(key)) continue

      attempted.current.add(key)
      void apiFetch<CuratedTourPayload>(`/travioghana/tours/${encodeURIComponent(key)}`)
        .then((payload) => {
          const tour = unwrapTour(payload)
          const supplierName = tour?.supplierName ?? tour?.supplier?.name
          if (!supplierName) return

          const location = [tour?.city, tour?.country].filter(Boolean).join(', ')
          updateItem(item.id, {
            supplierName,
            ...(tour?.title ? { title: tour.title } : {}),
            ...(location ? { location } : {}),
            ...(tour?.slug ? { slug: tour.slug } : {}),
            ...(tour?.id ? { tourId: tour.id } : {}),
          })
        })
        .catch(() => {
          // Leave the snapshot as-is; a later mount may retry the lookup.
        })
    }
  }, [items, updateItem])
}
