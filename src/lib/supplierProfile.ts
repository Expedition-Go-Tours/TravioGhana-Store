/**
 * Maps tour API supplier payloads to consumer-facing profile fields.
 *
 * The backend has no public "supplier profile by name" endpoint (all
 * /suppliers/* routes answer 401), so the public profile is derived from the
 * supplier block the tour endpoints carry:
 *
 *   GET /tours/:id → tour.supplier = {
 *     id, name, photoURL, verified, supplierType,
 *     supplierProfile: { averageRating, totalBookings, status, supplierType, businessInfo },
 *   }
 *
 * GET /tours (the list) carries the same block *without* businessInfo — see
 * src/lib/supplierResolution.ts for how the profile page recovers the full one.
 *
 * Everything the supplier maintains on their account dashboard lives in
 * businessInfo (probed against the live API, 32/32 tours):
 *   description, phone, website, address, city, region, country,
 *   legalBusinessName, businessType, operatingHours, instagram/tiktok/…
 *
 * Field names here follow what the API actually sends, not what the
 * registration wizard happens to post: businessInfo.phone (not phoneNumber),
 * businessInfo.address as a plain string (the wizard posts an object, so both
 * shapes are accepted), and no operatingInfo/representativeInfo at all — those
 * blocks are never present in public payloads, so nothing reads them any more.
 */

export interface SupplierSocialLink {
  network: string
  label: string
  url: string
}

export interface SupplierProfileData {
  supplierId: string | null
  name: string | null
  /** Registered legal name, when it differs from the trading name. */
  legalName: string | null
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
  /** Free-text business type from the account page, e.g. "Tour Operator". */
  businessType: string | null
  /** City from the account page, e.g. "Accra". */
  city: string | null
  /** ISO country code from the account page, e.g. "GH". */
  country: string | null
  /** Human-readable opening hours, e.g. "Every day 08:00–22:00". */
  operatingHours: string | null
  /** Whether the supplier is open right now. null when their hours are unknown. */
  isOpenNow: boolean | null
  socials: SupplierSocialLink[]
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
  tour?: RawSupplierTour | null
  /** Raw supplier block (used when only the supplier is available). */
  supplier?: SupplierBlock | null
  fallback?: Partial<SupplierProfileData>
}

/** Shape of a raw `/tours/:id` (or `/tours` list) item, as far as the mapper cares. */
export interface RawSupplierTour {
  id?: string | null
  slug?: string | null
  supplier?: SupplierBlock | null
  supplierId?: string | null
  city?: string | null
  averageRating?: number | string | null
  [key: string]: unknown
}

const asString = (value: unknown): string | null => {
  if (typeof value === 'string') {
    const trimmed = value.trim()
    return trimmed || null
  }
  if (typeof value === 'number' && Number.isFinite(value)) return String(value)
  return null
}

const COUNTRY_NAMES: Record<string, string> = {
  GH: 'Ghana',
  NG: 'Nigeria',
  CI: "Côte d'Ivoire",
  TG: 'Togo',
  BF: 'Burkina Faso',
  GB: 'United Kingdom',
  US: 'United States',
}

export function countryName(code: string | null | undefined): string | null {
  const value = asString(code)
  if (!value) return null
  return COUNTRY_NAMES[value.toUpperCase()] ?? value
}

/** Object-form address, as posted by the registration wizard. */
function formatAddressObject(address: Record<string, unknown>): string | null {
  const formatted = [address.line1, address.line2, address.city, address.state, address.postalCode]
    .map((part) => asString(part))
    .filter((part): part is string => Boolean(part))
    .join(', ')
  return formatted || null
}

/**
 * The API sends `businessInfo.address` as a formatted string
 * ("Nmai Dzorn Adjiringano Rd, Accra, Ghana"); the registration wizard posts an
 * object. Accept both, and only fall back to composing city/region/country when
 * there is no address at all — never append parts the address already carries.
 */
export function formatSupplierAddress(
  raw: unknown,
  extras: { city?: unknown; region?: unknown; country?: unknown } = {},
): string | null {
  if (typeof raw === 'string') {
    const trimmed = raw.trim()
    if (trimmed) return trimmed
  }
  if (raw && typeof raw === 'object') {
    const formatted = formatAddressObject(raw as Record<string, unknown>)
    if (formatted) return formatted
  }
  const parts = [
    asString(extras.city),
    asString(extras.region),
    countryName(asString(extras.country)),
  ].filter((part): part is string => Boolean(part))
  return parts.length ? parts.join(', ') : null
}

const WEEKDAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']
const WEEKDAY_SHORT: Record<string, string> = {
  Monday: 'Mon',
  Tuesday: 'Tue',
  Wednesday: 'Wed',
  Thursday: 'Thu',
  Friday: 'Fri',
  Saturday: 'Sat',
  Sunday: 'Sun',
}

/** "08:00–22:00" for one day, or "08:00–12:00, 14:00–18:00" for split days. */
function formatDayWindows(windows: unknown): string | null {
  if (!Array.isArray(windows)) return null
  const parts = windows
    .map((window) => {
      if (typeof window === 'string') return window.trim() || null
      if (!window || typeof window !== 'object') return null
      const { startTime, endTime } = window as { startTime?: unknown; endTime?: unknown }
      const start = asString(startTime)
      const end = asString(endTime)
      if (!start && !end) return null
      return `${start ?? ''}–${end ?? ''}`
    })
    .filter((part): part is string => Boolean(part))
  return parts.length ? parts.join(', ') : null
}

/**
 * Normalises the account page's operating hours (day → window list) into one
 * line, collapsing consecutive days that share the same hours:
 *   all 7 identical            → "Every day 08:00–22:00"
 *   Mon–Fri same, Sat different → "Mon–Fri 08:00–22:00; Sat 09:00–13:00"
 * Days the supplier left blank are omitted rather than reported as closed —
 * missing data is not the same statement as "Closed".
 */
export function normaliseOperatingHours(raw: unknown): string | null {
  if (typeof raw === 'string') return asString(raw)
  if (!raw || typeof raw !== 'object') return null
  const source = raw as Record<string, unknown>

  const entries = WEEKDAYS
    .map((day) => ({ day, windows: formatDayWindows(source[day]) }))
    .filter((entry): entry is { day: string; windows: string } => Boolean(entry.windows))

  if (!entries.length) return null
  if (entries.length === WEEKDAYS.length && entries.every((entry) => entry.windows === entries[0].windows)) {
    return `Every day ${entries[0].windows}`
  }

  const groups: { first: string; last: string; windows: string }[] = []
  for (const entry of entries) {
    const previous = groups[groups.length - 1]
    if (previous && previous.windows === entry.windows) {
      previous.last = entry.day
    } else {
      groups.push({ first: entry.day, last: entry.day, windows: entry.windows })
    }
  }

  return groups
    .map((group) => {
      const label = group.first === group.last
        ? WEEKDAY_SHORT[group.first]
        : `${WEEKDAY_SHORT[group.first]}–${WEEKDAY_SHORT[group.last]}`
      return `${label} ${group.windows}`
    })
    .join('; ')
}

/** Minutes since midnight for "HH:MM" (also "H:MM"), or null when malformed. */
function parseClockValue(value: unknown): number | null {
  const match = asString(value)?.match(/^(\d{1,2}):(\d{2})$/)
  if (!match) return null
  const hours = Number(match[1])
  const minutes = Number(match[2])
  if (hours > 23 || minutes > 59) return null
  return hours * 60 + minutes
}

function isWithinWindow(nowMinutes: number, start: number, end: number): boolean {
  if (end === start) return false
  if (end > start) return nowMinutes >= start && nowMinutes < end
  // Overnight window (e.g. 22:00–02:00) wraps past midnight.
  return nowMinutes >= start || nowMinutes < end
}

/**
 * Whether the supplier is open right now, from their raw account-page hours.
 * Handles the structured day → windows object the wizard posts and the
 * collapsed "Every day HH:MM–HH:MM" string; anything else answers null
 * (unknown) rather than claiming the supplier is closed.
 */
export function isSupplierOpenNow(raw: unknown, now = new Date()): boolean | null {
  const nowMinutes = now.getHours() * 60 + now.getMinutes()

  if (typeof raw === 'string') {
    const match = raw.match(/every day\s+(\d{1,2}:\d{2})\s*[–—-]\s*(\d{1,2}:\d{2})/i)
    if (!match) return null
    const start = parseClockValue(match[1])
    const end = parseClockValue(match[2])
    if (start == null || end == null) return null
    return isWithinWindow(nowMinutes, start, end)
  }

  if (!raw || typeof raw !== 'object') return null
  const day = WEEKDAYS[(now.getDay() + 6) % 7]
  const windows = (raw as Record<string, unknown>)[day]
  if (!Array.isArray(windows)) return null
  for (const window of windows) {
    if (!window || typeof window !== 'object') continue
    const start = parseClockValue((window as { startTime?: unknown }).startTime)
    const end = parseClockValue((window as { endTime?: unknown }).endTime)
    if (start == null || end == null) continue
    if (isWithinWindow(nowMinutes, start, end)) return true
  }
  return false
}

const SOCIAL_FIELDS: { key: string; label: string }[] = [
  { key: 'instagram', label: 'Instagram' },
  { key: 'facebook', label: 'Facebook' },
  { key: 'tiktok', label: 'TikTok' },
  { key: 'youtube', label: 'YouTube' },
  { key: 'twitter', label: 'X' },
  { key: 'linkedin', label: 'LinkedIn' },
  { key: 'pinterest', label: 'Pinterest' },
  { key: 'whatsapp', label: 'WhatsApp' },
]

/**
 * The account page stores social profiles (the live payloads carry full URLs,
 * e.g. "https://instagram.com/expeditiongotours"). Bare handles and bare
 * WhatsApp numbers are accepted too, since the portal allows both.
 */
export function extractSupplierSocials(businessInfo: Record<string, unknown> | null | undefined): SupplierSocialLink[] {
  if (!businessInfo) return []
  const links: SupplierSocialLink[] = []

  for (const { key, label } of SOCIAL_FIELDS) {
    const raw = asString(businessInfo[key])
    if (!raw) continue

    let url: string
    if (key === 'whatsapp' && /^[+\d][\d\s()-]+$/.test(raw)) {
      url = `https://wa.me/${raw.replace(/[^\d]/g, '')}`
    } else if (/^https?:\/\//i.test(raw)) {
      url = raw
    } else if (key === 'whatsapp') {
      url = `https://wa.me/${raw.replace(/[^\d]/g, '')}`
    } else {
      url = `https://${raw.replace(/^\/+/, '')}`
    }

    links.push({ network: key, label, url })
  }

  return links
}

/**
 * The account page's own "about" copy. The live payloads carry it in
 * businessInfo.description; the synthesised sentence below is only a fallback
 * for suppliers who have not written one yet.
 */
function buildFallbackDescription(
  businessInfo: Record<string, unknown> | undefined,
  operatingInfo: Record<string, unknown> | undefined,
): string | null {
  const name = asString(businessInfo?.displayName) || asString(businessInfo?.legalBusinessName)
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
 *
 * `rating` is the *supplier's* average only. Callers that want to fall back to
 * a specific tour's rating (the tour-detail card does) apply that themselves —
 * quietly substituting a tour rating here made the profile page report one
 * tour's score as the supplier's.
 */
export function mapSupplierProfile({ tour, supplier, fallback }: SupplierProfileInput = {}): SupplierProfileData {
  const sup = supplier || tour?.supplier || null
  const profile = sup?.supplierProfile
  const businessInfo = (profile?.businessInfo || {}) as Record<string, unknown>
  const representativeInfo = (profile?.representativeInfo || {}) as Record<string, unknown>
  const operatingInfo = (profile?.operatingInfo || {}) as Record<string, unknown>

  const contactName = asString(businessInfo.displayName) || asString(businessInfo.legalBusinessName)
  const legalName = asString(businessInfo.legalBusinessName)

  const name =
    sup?.name ||
    contactName ||
    fallback?.name ||
    null

  const ratingRaw = profile?.averageRating ?? fallback?.rating
  const rating = ratingRaw != null && Number(ratingRaw) > 0 ? Number(ratingRaw) : null

  const description =
    asString(businessInfo.description) ||
    (profile ? buildFallbackDescription(businessInfo, operatingInfo) : null) ||
    fallback?.description ||
    null

  return {
    supplierId: sup?.id || tour?.supplierId || fallback?.supplierId || null,
    name,
    legalName: legalName && legalName !== name ? legalName : null,
    logo: sup?.logoUrl || sup?.photoURL || fallback?.logo || '',
    email: asString(sup?.email) || asString(businessInfo.email) || asString(representativeInfo.email) || fallback?.email || null,
    phone: asString(sup?.phone) || asString(businessInfo.phone) || asString(businessInfo.phoneNumber) || asString(representativeInfo.phoneNumber) || fallback?.phone || null,
    website: asString(sup?.website) || asString(businessInfo.website) || fallback?.website || null,
    address:
      formatSupplierAddress(businessInfo.address, {
        city: businessInfo.city,
        region: businessInfo.region,
        country: businessInfo.country,
      }) ||
      fallback?.address ||
      tour?.city ||
      null,
    description,
    rating,
    // `totalBookings` is NOT a tour count — mapping it here made this field
    // report a supplier's bookings as their tour total (e.g. 7 for a supplier
    // with 31 tours). The tour payload carries no tour count; callers that
    // need the real figure use useSupplierTourCount() (/tours?supplierId=… →
    // pagination.totalCount) or the resolved list length.
    toursCount: fallback?.toursCount ?? 0,
    verified: (sup?.verified ?? profile?.verified) ?? (profile?.status === 'ACTIVE' || profile?.status === 'APPROVED'),
    supplierType: sup?.supplierType ?? profile?.supplierType ?? fallback?.supplierType ?? null,
    businessType: asString(businessInfo.businessType) || null,
    city: asString(businessInfo.city) || null,
    country: countryName(asString(businessInfo.country)),
    operatingHours: normaliseOperatingHours(businessInfo.operatingHours),
    isOpenNow: isSupplierOpenNow(businessInfo.operatingHours),
    socials: extractSupplierSocials(businessInfo),
  }
}

export function normalizeWebsiteUrl(website: string | null | undefined): string | null {
  if (!website || typeof website !== 'string') return null
  const trimmed = website.trim()
  if (!trimmed) return null
  if (/^https?:\/\//i.test(trimmed)) return trimmed
  return `https://${trimmed}`
}
