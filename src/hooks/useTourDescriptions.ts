import { useQuery } from '@tanstack/react-query'
import { fetchWithAuth } from '../lib/api'

/**
 * The tour catalogue with descriptions.
 *
 * The homepage endpoints don't project tour descriptions, but the bottom-of-
 * page "top recommendations" section needs an excerpt per row. The catalogue
 * listing carries them (one page today — the endpoint caps `limit` at 50), so
 * this hook loads it once and serves both the description excerpts and the
 * last-resort filler. It is only mounted by the section itself (below the
 * page, behind MountOnView), so the homepage never pays for it until the
 * visitor approaches the section.
 */

export interface TourCatalogItem {
  id: string
  title: string
  slug: string
  image: string
  description: string
}

/**
 * Trim + normalize the multi-line descriptions the catalogue stores. Each
 * non-empty line becomes a paragraph (joined back with `\n`) so the expanded
 * card can render the same paragraph structure as the tour detail page.
 */
export function cleanTourDescription(value: unknown): string {
  if (typeof value !== 'string') return ''
  return value
    .split(/\r?\n/)
    .map((line) => line.replace(/[ \t]+/g, ' ').trim())
    .filter((line) => line.length > 0)
    .join('\n')
}

function toCatalogItem(raw: Record<string, unknown> | null | undefined): TourCatalogItem | null {
  if (!raw) return null
  const id = typeof raw.id === 'string' ? raw.id : ''
  const title = typeof raw.title === 'string' ? raw.title : ''
  if (!id || !title) return null
  const photos = Array.isArray(raw.photos)
    ? raw.photos.filter((photo): photo is string => typeof photo === 'string' && photo.length > 0)
    : []
  const cover = typeof raw.coverPhoto === 'string' ? raw.coverPhoto : ''
  return {
    id,
    title,
    slug: typeof raw.slug === 'string' ? raw.slug : '',
    image: cover || photos[0] || '',
    description: cleanTourDescription(raw.description),
  }
}

export function useTourDescriptions(enabled = true) {
  return useQuery({
    queryKey: ['tour-catalog', 'descriptions'],
    queryFn: async (): Promise<TourCatalogItem[]> => {
      const res = await fetchWithAuth('/travioghana/tours?limit=50')
      const payload = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(payload?.message || `Request failed (${res.status})`)
      const data = payload?.data ?? payload
      const rows: unknown[] = Array.isArray(data?.tours) ? data.tours : Array.isArray(payload?.tours) ? payload.tours : []
      return rows.map((row) => toCatalogItem(row as Record<string, unknown>)).filter((item): item is TourCatalogItem => item !== null)
    },
    staleTime: 5 * 60 * 1000,
    enabled,
  })
}
