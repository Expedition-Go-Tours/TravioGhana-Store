/**
 * Supplier onboarding API client.
 *
 * Endpoints (all Bearer-auth protected, provided by Travio Ghana-Backend):
 *   POST /suppliers/apply              — submit a supplier application (multipart)
 *   GET  /suppliers/application/status — poll the current user's application status
 */
import { apiFetch } from './api'
import { getStoredAuthTokens } from './auth'

/** Travio Ghana-Supplier platform origin (approved suppliers SSO here). */
export const SUPPLIER_PLATFORM_URL =
  (import.meta.env.VITE_SUPPLIER_PLATFORM_URL as string | undefined) || 'https://supplier.travioghana.com'

export interface SupplierAddress {
  line1: string
  line2?: string
  city: string
  state: string
  postalCode: string
}

export interface SupplierProfile {
  id: string
  userId: string
  status: string
  supplierType?: string
  businessInfo?: Record<string, unknown>
  operatingInfo?: Record<string, unknown>
  representativeInfo?: Record<string, unknown>
  payoutInfo?: Record<string, unknown>
  businessDocuments?: Record<string, unknown>
  compliance?: Record<string, unknown>
  createdAt?: string
  updatedAt?: string
}

export type SupplierApplicationStatus =
  | 'PENDING'
  | 'UNDER_REVIEW'
  | 'APPROVED'
  | 'REJECTED'
  | 'ACTIVE'
  | 'SUSPENDED'
  | 'EXPIRED'

export const SUPPLIER_TYPES: { value: string; label: string; description: string }[] = [
  { value: 'TOUR_GUIDE', label: 'Tour Guide', description: 'An individual who leads tours, with their own licence and ID.' },
  { value: 'TOUR_COMPANY', label: 'Tour Company', description: 'A registered business that operates tours and hires guides.' },
  { value: 'ACCOMMODATION_PROVIDER', label: 'Accommodation Provider', description: 'A business offering stays to travellers.' },
  { value: 'TRANSPORTATION_PROVIDER', label: 'Transportation Provider', description: 'A business offering car, van, bus or shuttle services.' },
  { value: 'VEHICLE_OPERATOR', label: 'Vehicle / Shuttle Operator', description: 'An individual or business that operates one or more vehicles.' },
  { value: 'OTHER_SERVICE_PROVIDER', label: 'Other Tourism Service', description: 'Any other tourism service not covered above.' },
]

export function supplierTypeLabel(type?: string | null): string {
  const found = SUPPLIER_TYPES.find((s) => s.value === type)
  return found?.label ?? type ?? '—'
}

/** Document types a supplier must provide, based on their category and country. */
export function documentRequirementsFor(supplierType: string, country: string): string[] {
  const isGhana = country === 'GH'
  const identity = isGhana ? 'GHANA_CARD' : 'NATIONAL_ID'
  const reqs: string[] = [identity, 'PROOF_OF_ADDRESS', 'PROFILE_PHOTO']
  switch (supplierType) {
    case 'TOUR_GUIDE':
      reqs.push('TOUR_GUIDE_LICENCE')
      reqs.push('DRIVERS_LICENCE')
      break
    case 'TOUR_COMPANY':
    case 'ACCOMMODATION_PROVIDER':
      reqs.push('BUSINESS_CERTIFICATE')
      if (isGhana) reqs.push('GTA_CERTIFICATE')
      break
    case 'TRANSPORTATION_PROVIDER':
      reqs.push('BUSINESS_CERTIFICATE')
      reqs.push('PASSENGER_TRANSPORT_LICENCE')
      if (isGhana) reqs.push('GTA_CERTIFICATE')
      break
    case 'VEHICLE_OPERATOR':
      reqs.push('BUSINESS_CERTIFICATE')
      reqs.push('PASSENGER_TRANSPORT_LICENCE')
      break
    default:
      break
  }
  return reqs
}

/** Document types that must be attached to each listed vehicle. */
export const VEHICLE_DOC_TYPES: { type: string; label: string }[] = [
  { type: 'VEHICLE_REGISTRATION', label: 'Vehicle registration' },
  { type: 'VEHICLE_OWNERSHIP', label: 'Ownership document' },
  { type: 'VEHICLE_ROADWORTHINESS', label: 'Roadworthiness certificate' },
  { type: 'VEHICLE_INSURANCE', label: 'Insurance certificate' },
]

/** Document types attached to each guide on a company's team. */
export const GUIDE_DOC_TYPES: { type: string; label: string }[] = [
  { type: 'TOUR_GUIDE_LICENCE', label: 'Tour guide licence' },
  { type: 'DRIVERS_LICENCE', label: "Driver's licence" },
]

export function documentTypeLabel(type?: string | null): string {
  return (type || 'Other').replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase())
}

/**
 * Submit a supplier application.
 * The payload must be multipart/form-data: each JSON section is appended as a
 * JSON-string field, and documents as file fields (matches the backend route
 * and multer upload configuration).
 */
export async function applyAsSupplier(payload: FormData): Promise<{ supplierProfile: SupplierProfile }> {
  return apiFetch('/suppliers/apply', {
    method: 'POST',
    body: payload,
  })
}

/**
 * Get the current user's supplier application status.
 * Returns null when no application exists yet (backend responds 404).
 */
export async function getSupplierApplicationStatus(): Promise<SupplierProfile | null> {
  try {
    const payload = await apiFetch<{ supplierProfile: SupplierProfile }>('/suppliers/application/status')
    return payload?.supplierProfile ?? null
  } catch (err: unknown) {
    if ((err as { status?: number })?.status === 404) return null
    throw err
  }
}

/** Statuses that mean the supplier has been approved to use the platform. */
export function isApprovedSupplier(status?: string): boolean {
  return status === 'APPROVED' || status === 'ACTIVE'
}

/**
 * Build the Travio Ghana-Supplier SSO login URL for an approved supplier.
 * Pass an already-fetched profile to avoid a redundant status request.
 * Returns null when the user isn't signed in, isn't approved, or the status
 * check fails (so callers can fall back to the regular register flow).
 */
export async function getSupplierPortalUrl(profile?: SupplierProfile | null): Promise<string | null> {
  const { accessToken, refreshToken } = getStoredAuthTokens()
  if (!accessToken) return null

  let effectiveProfile = profile
  if (effectiveProfile === undefined) {
    try {
      effectiveProfile = await getSupplierApplicationStatus()
    } catch {
      return null
    }
  }

  if (!effectiveProfile || !isApprovedSupplier(effectiveProfile.status)) return null

  const params = new URLSearchParams({ accessToken })
  if (refreshToken) params.set('refreshToken', refreshToken)
  return `${SUPPLIER_PLATFORM_URL}/auth/callback?${params.toString()}`
}
