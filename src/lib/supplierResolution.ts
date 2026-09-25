/**
 * Recovers a supplier's full profile from the tour endpoints.
 *
 * Why this exists: the backend has no public supplier endpoint (every
 * /suppliers/* route answers 401), and the two tour payloads differ in a way
 * that matters:
 *
 *   GET /tours/:id    → supplier.supplierProfile.businessInfo  ← the complete
 *                       account-page data (description, phone, address, hours,
 *                       socials): present on 32/32 live tours
 *   GET /tours        → the same supplier block WITHOUT businessInfo:
 *                       present on 0/32 live list items
 *
 * So a profile page that resolves a supplier from the list alone renders a name
 * and a rating and nothing else — which is what a direct visit or a refresh
 * used to do (router state carries the tour id only on the "View more" click).
 * This module walks name → supplier id → one of their tours → the detail
 * payload, so every entry path ends up with the full block.
 */
import { apiFetch, fetchWithAuth } from './api'
import type { RawSupplierTour } from './supplierProfile'

/** Supplier ids are cuids, e.g. cmp cxwl3k0000caylg0jcp879. */
export const SUPPLIER_ID_PATTERN = /^c[a-z0-9]{20,}$/i

export function isSupplierId(segment: string): boolean {
  return SUPPLIER_ID_PATTERN.test(segment.trim())
}

/**
 * Splits the `/supplier/:segment` route param into an id or a name, so links
 * created before (and search engines holding) `/supplier/Kadelo%20Travels`
 * keep working while `/supplier/<id>` survives a business rename.
 */
export function classifySupplierSegment(segment: string): { supplierId: string | null; name: string | null } {
  const decoded = decodeURIComponent(segment || '').trim()
  if (!decoded) return { supplierId: null, name: null }
  if (isSupplierId(decoded)) return { supplierId: decoded, name: null }
  return { supplierId: null, name: decoded }
}

/** Case- and punctuation-insensitive comparison ("Expedition-Go Tours LTD" ≈ "expedition go tours ltd"). */
export function normaliseSupplierName(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()
}

/** Page size for the name scan — the catalogue is ~32 tours, so one page today. */
const CATALOGUE_PAGE_SIZE = 500
/** Hard stop on the name scan so a huge catalogue can never hang the page. */
const MAX_SCAN_PAGES = 4

async function fetchRawTour(idOrSlug: string): Promise<RawSupplierTour | null> {
  // A 404 means "no such tour" → null. A thrown fetch (offline, CORS, 5xx)
  // propagates so the page can tell "we could not load this" apart from
  // "this supplier does not exist" — showing "Supplier not found" for a
  // network failure sent people hunting for a supplier that was right there.
  const res = await fetchWithAuth(`/tours/${encodeURIComponent(idOrSlug)}`)
  if (!res.ok) return null
  const payload = await res.json().catch(() => ({}))
  const tour = payload?.data?.tour ?? payload?.tour ?? payload
  return (tour as RawSupplierTour) ?? null
}

/** One tour id belonging to a supplier — the handle needed to fetch their detail payload. */
async function firstTourIdForSupplier(supplierId: string): Promise<string | null> {
  const payload = await apiFetch<{ tours?: RawSupplierTour[] }>(
    `/tours?supplierId=${encodeURIComponent(supplierId)}&limit=1`,
  )
  const tour = payload?.tours?.[0]
  return tour?.id ?? tour?.slug ?? null
}

interface NameScanResult {
  supplierId: string | null
  /** The list item we matched — it carries the reduced block, no businessInfo. */
  tour: RawSupplierTour | null
}

/**
 * Finds the supplier id behind a `/supplier/<name>` URL. The list payload does
 * carry `supplier.name` (only businessInfo is missing), so the scan works; it
 * is bounded, and the id it returns unlocks the detail payload.
 */
async function findSupplierByName(name: string): Promise<NameScanResult> {
  const needle = normaliseSupplierName(name)
  if (!needle) return { supplierId: null, tour: null }

  for (let page = 1; page <= MAX_SCAN_PAGES; page += 1) {
    // Throws on failure on purpose: only a *successful* search that finds
    // nobody may render as "Supplier not found".
    const payload = await apiFetch<{ tours?: RawSupplierTour[]; pagination?: { hasNextPage?: boolean } }>(
      `/tours?limit=${CATALOGUE_PAGE_SIZE}&page=${page}`,
    )
    const tours = Array.isArray(payload?.tours) ? payload.tours : []
    if (!tours.length) break

    const match = tours.find(
      (tour) => tour?.supplier?.name && normaliseSupplierName(tour.supplier.name) === needle,
    )
    if (match?.supplier?.id) return { supplierId: match.supplier.id, tour: match }
    if (!payload?.pagination?.hasNextPage) break
  }

  return { supplierId: null, tour: null }
}

export interface SupplierIdentity {
  /** Tour id carried in router state by the "View more" link. */
  tourId?: string | null
  /** Supplier id, from the route (/supplier/<id>) or router state. */
  supplierId?: string | null
  /** Name from the route (/supplier/<name>). */
  name?: string | null
}

/**
 * Resolves the raw tour that carries the supplier's full profile block.
 * Prefers the exact tour id, then the supplier id, then a catalogue scan by
 * name. Returns null only when the supplier cannot be found at all.
 */
export async function resolveSupplierProfileTour({
  tourId,
  supplierId,
  name,
}: SupplierIdentity): Promise<RawSupplierTour | null> {
  let partial: RawSupplierTour | null = null

  if (tourId) {
    const tour = await fetchRawTour(tourId)
    if (tour?.supplier?.supplierProfile) return tour
    if (tour) partial = tour
  }

  let resolvedSupplierId = supplierId || null
  if (!resolvedSupplierId && name) {
    const scan = await findSupplierByName(name)
    resolvedSupplierId = scan.supplierId
    partial = partial ?? scan.tour
  }

  if (resolvedSupplierId) {
    const firstTourId = await firstTourIdForSupplier(resolvedSupplierId)
    if (firstTourId) {
      const tour = await fetchRawTour(firstTourId)
      if (tour?.supplier) return tour
    }
  }

  // Last resort: the reduced list block still renders name, logo, rating and
  // tour count, which beats "Supplier not found" for a supplier we did find.
  return partial
}
