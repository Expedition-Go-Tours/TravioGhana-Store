/**
 * Canonical tour URLs.
 *
 * Shape: `/tour/{id}/{slug}` (and `/{id}/{slug}/booking`). The **id is the
 * identity** — it never changes, so retitling a tour (which regenerates its
 * slug) cannot break a shared, bookmarked or indexed link. The slug is
 * decorative: it makes the URL readable, and the API resolves the first
 * segment as either an id or a slug, so the single-segment form still works.
 *
 * When the id is unknown (static/mock card content, legacy search entries)
 * the helpers fall back to the slug-only form.
 */

const seg = (value: string) => encodeURIComponent(value)

export function tourPath(id?: string | null, slug?: string | null): string {
  if (id && slug) return `/tour/${seg(id)}/${seg(slug)}`
  return `/tour/${seg(id || slug || '')}`
}

export function bookingPath(id?: string | null, slug?: string | null): string {
  const idSegment = id || slug || ''
  const slugSegment = slug || idSegment
  return `/${seg(idSegment)}/${seg(slugSegment)}/booking`
}
