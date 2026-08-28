/**
 * Maps tour API supplier payloads to consumer-facing profile fields.
 *
 * The backend has no public "supplier profile by name" endpoint, but the tour
 * endpoints carry the data:
 *   GET /tours/:id  → tour.supplier = { id, name, photoURL,
 *                       supplierProfile: { averageRating, totalBookings, businessInfo } }
 * The supplier's public business details (name, address, phone, website) live
 * in businessInfo, written by the supplier application form
 * (src/components/supplier/SupplierApplicationForm.tsx).
 */

export interface SupplierProfileData {
  supplierId: string | null
  name: string | null
  logo: string
  email: string | null
  phone: string | null
  website: string | null
  address: string | null
  description: string | null
  rating: number | null
  toursCount: number
  verified: boolean
  supplierType: string | null
}

interface SupplierBlock {
  id?: string | null
  name?: string | null
  photoURL?: string | null
  logoUrl?: string | null
  email?: string | null
  phone?: string | null
  website?: string | null
  verified?: boolean | null
  supplierType?: string | null
  supplierProfile?: {
    averageRating?: number | string | null
    totalBookings?: number | null
    status?: string | null
    supplierType?: string | null
    verified?: boolean | null
    businessInfo?: Record<string, unknown> | null
    operatingInfo?: Record<string, unknown> | null
    representativeInfo?: Record<string, unknown> | null
  } | null
}

interface SupplierProfileInput {
  tour?: {
    supplier?: SupplierBlock | null
    supplierId?: string | null
    city?: string | null
    averageRating?: number | string | null
  } | null
  /** Raw supplier block (used when only the supplier is available). */
  supplier?: SupplierBlock | null
  fallback?: Partial<SupplierProfileData>
}

function formatBusinessAddress(address: unknown): string | null {
  if (!address || typeof address !== 'object') return null
  const a = address as Record<string, unknown>
  const formatted = [a.line1, a.line2, a.city, a.state, a.postalCode]
    .filter((part) => part && String(part).trim())
    .join(', ')
  return formatted || null
}

function buildSupplierDescription(businessInfo: Record<string, unknown> | undefined, operatingInfo: Record<string, unknown> | undefined): string | null {
  const name = (businessInfo?.displayName as string | undefined)
    || (businessInfo?.legalBusinessName as string | undefined)
  const segments: string[] = []

  if (name) segments.push(`${name} offers guided experiences`)
  const destinations = Array.isArray(operatingInfo?.destinations)
    ? (operatingInfo.destinations as unknown[])
      .map((d) => typeof d === 'string' ? d : (d as { name?: string })?.name)
      .filter((d): d is string => Boolean(d))
      .slice(0, 6)
    : []
  if (destinations.length) segments.push(`in ${destinations.join(', ')}`)
  if (Array.isArray(operatingInfo?.languages) && (operatingInfo.languages as unknown[]).length) {
    segments.push(`Languages: ${(operatingInfo.languages as unknown[]).join(', ')}`)
  }
  if (typeof operatingInfo?.cancellationPolicy === 'string' && operatingInfo.cancellationPolicy) {
    segments.push(operatingInfo.cancellationPolicy)
  }

  return segments.length ? `${segments.join('. ')}.` : null
}

/**
 * Maps a tour (or raw supplier block) into the consumer-facing profile fields
 * rendered on the supplier page and the tour-detail "About this supplier" card.
 */
export function mapSupplierProfile({ tour, supplier, fallback }: SupplierProfileInput = {}): SupplierProfileData {
  const sup = supplier || tour?.supplier || null
  const profile = sup?.supplierProfile
  const businessInfo = (profile?.businessInfo || {}) as Record<string, unknown>
  const representativeInfo = (profile?.representativeInfo || {}) as Record<string, unknown>
  const operatingInfo = (profile?.operatingInfo || {}) as Record<string, unknown>

  const name =
    sup?.name ||
    (businessInfo.displayName as string | undefined) ||
    (businessInfo.legalBusinessName as string | undefined) ||
    fallback?.name ||
    null

  const ratingRaw = sup?.supplierProfile?.averageRating ?? tour?.averageRating ?? fallback?.rating
  const rating = ratingRaw != null && Number(ratingRaw) > 0 ? Number(ratingRaw) : null

  return {
    supplierId: sup?.id || tour?.supplierId || fallback?.supplierId || null,
    name,
    logo: sup?.logoUrl || sup?.photoURL || fallback?.logo || '',
    email: sup?.email || (representativeInfo.email as string | undefined) || fallback?.email || null,
    phone: sup?.phone || (businessInfo.phoneNumber as string | undefined) || (representativeInfo.phoneNumber as string | undefined) || fallback?.phone || null,
    website: sup?.website || (businessInfo.website as string | undefined) || fallback?.website || null,
    address: formatBusinessAddress(businessInfo.address) || fallback?.address || tour?.city || null,
    description: sup?.supplierProfile ? buildSupplierDescription(businessInfo, operatingInfo) || null : (fallback?.description || null),
    rating,
    toursCount: profile?.totalBookings ?? fallback?.toursCount ?? 0,
    verified: (sup?.verified ?? profile?.verified) ?? (profile?.status === 'ACTIVE' || profile?.status === 'APPROVED'),
    supplierType: sup?.supplierType ?? profile?.supplierType ?? fallback?.supplierType ?? null,
  }
}

export function normalizeWebsiteUrl(website: string | null | undefined): string | null {
  if (!website || typeof website !== 'string') return null
  const trimmed = website.trim()
  if (!trimmed) return null
  if (/^https?:\/\//i.test(trimmed)) return trimmed
  return `https://${trimmed}`
}
