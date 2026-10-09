import { useQueries } from '@tanstack/react-query'
import { fetchWithAuth } from '../lib/api'

/**
 * Full tour descriptions for the "top recommendations" section, fetched from
 * the same endpoint the tour detail page uses (GET /tours/:id).
 *
 * The curated catalogue endpoint (`/travioghana/tours`) is not used: its rows
 * truncate descriptions at 300 characters — and it intermittently serves rows
 * with no description at all and without the tour ids the homepage ranks — so
 * joining against it left cards with no text. The detail endpoint is
 * id-addressable and always carries the complete description; the section
 * loads exactly the tours it displays (ten), in parallel, once it scrolls
 * into view, and react-query caches each one for repeat visits.
 */

/** Trim + normalize the multi-line descriptions the API stores. Each
 *  non-empty line becomes a paragraph (joined back with `\n`) so cards can
 *  render the same paragraph structure as the tour detail page. */
export function cleanTourDescription(value: unknown): string {
  if (typeof value !== 'string') return ''
  return value
    .split(/\r?\n/)
    .map((line) => line.replace(/[ \t]+/g, ' ').trim())
    .filter((line) => line.length > 0)
    .join('\n')
}

function fetchTourDescription(tourId: string) {
  return fetchWithAuth(`/tours/${encodeURIComponent(tourId)}`)
    .then(async (res) => {
      const payload = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(payload?.message || `Request failed (${res.status})`)
      const tour = payload?.data?.tour ?? payload?.tour ?? payload
      return cleanTourDescription(tour?.description)
    })
}

/**
 * A map of tour id → full description for the given ids. Queries are
 * independent, so one missing/failed tour never blocks the others; callers
 * render a card without its excerpt when its id is absent from the map.
 */
export function useTourDescriptionsByIds(ids: string[], enabled = true) {
  return useQueries({
    queries: ids.map((id) => ({
      queryKey: ['tour-full-description', id],
      queryFn: () => fetchTourDescription(id),
      staleTime: 5 * 60 * 1000,
      enabled: enabled && id.length > 0,
    })),
    combine: (results): Map<string, string> => {
      const descriptions = new Map<string, string>()
      results.forEach((result, index) => {
        const id = ids[index]
        if (id && result.data) descriptions.set(id, result.data)
      })
      return descriptions
    },
  })
}
