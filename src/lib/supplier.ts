/**
 * Supplier onboarding API client.
 *
 * Endpoints (all Bearer-auth protected, provided by Travio Ghana-Backend):
 *   POST /suppliers/apply              — submit a supplier application (multipart)
 *   GET  /suppliers/application/status — poll the current user's application status
 */
import { apiFetch, apiUploadWithProgress } from './api'
import { getStoredAuthTokens } from './auth'

/** TravioAfrica-Supplier platform origin (approved suppliers SSO here). */
export const SUPPLIER_PLATFORM_URL =
  (import.meta.env.VITE_SUPPLIER_PLATFORM_URL as string | undefined) || 'https://supplier.travioafrica.com'

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
  /** Reviewer note written on reject / request-info (TravioGhana-Admin). */
  adminNotes?: string | null
  reviewedAt?: string | null
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

/**
 * Total files a single application may upload in one request.
 *
 * Mirrors MAX_SUPPLIER_DOCUMENT_FILES in the backend
 * (config/supplierUploadFields.js) — the sum of that upload's per-field
 * `maxCount`s (legacy named fields + `documents` + `vehiclePhotos`). The form
 * pre-flights against this so a supplier with several vehicles gets an
 * actionable message instead of the backend's generic 400 "Too many files
 * uploaded".
 */
export const MAX_SUPPLIER_APPLICATION_FILES = 1 + 1 + 1 + 1 + 5 + 30 + 30

/**
 * Largest single document accepted, mirroring multer's `limits.fileSize` in the
 * backend (config/cloudinary.js: 10 * 1024 * 1024). Checked before upload so the
 * supplier gets a clear message instead of a mid-submit failure.
 */
export const MAX_SUPPLIER_DOCUMENT_BYTES = 10 * 1024 * 1024

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
 * One document in the per-operator requirements matrix, as computed by the
 * backend (GET /suppliers/requirements). The label and detail strings ARE the
 * copy the wizard and the supplier dashboard both render — there is no
 * storefront-side copy anymore, which is what keeps them identical.
 */
export interface RequirementDocument {
  type: string
  label: string
  detail: string
  required: boolean
  timing: 'upfront' | 'later' | 'per_vehicle' | 'per_guide'
  ownerType: 'SUPPLIER' | 'VEHICLE' | 'GUIDE'
  enforced: boolean
}

export interface SupplierRequirements {
  supplierType: string
  supplierChoice: string | null
  supplierChoiceLabel: string | null
  // The 30-day window for the non-required documents, counted from when the
  // account goes live. Served by the backend so the signup promise and the
  // dashboard countdown can never drift apart.
  documentationGraceDays: number
  documents: RequirementDocument[]
  vehicleDocuments: RequirementDocument[]
  guideDocuments: RequirementDocument[]
  vehicles: 'required' | 'optional' | 'hidden'
  guides: 'required' | 'optional' | 'hidden'
}

/**
 * Fetch the verification matrix for a PROPOSED supplier choice + services.
 *
 * This is the single source of the wizard's "later, if needed" list (and the
 * up-front set while it is loading). It calls the backend's requirements
 * endpoint rather than keeping a copy, so what an applicant is told at signup
 * is exactly what the dashboard will later ask for. Returns null on any
 * failure so the form can degrade (the up-front docs are also enforced
 * server-side, and the local kind-based fallback matches them exactly).
 */
export async function fetchSupplierRequirements(
  params: { supplierChoice?: string | null; services?: string[] }
): Promise<SupplierRequirements | null> {
  try {
    const query = new URLSearchParams()
    if (params.supplierChoice) query.set('supplierChoice', params.supplierChoice)
    ;(params.services ?? []).forEach((service) => query.append('services', service))
    return (await apiFetch<{ requirements: SupplierRequirements }>(
      `/suppliers/requirements?${query.toString()}`
    ))?.requirements ?? null
  } catch {
    return null
  }
}

/**
 * Submit a supplier application.
 * The payload must be multipart/form-data: each JSON section is appended as a
 * JSON-string field, and documents as file fields (matches the backend route
 * and multer upload configuration).
 *
 * `onUploadProgress` reports the document upload percentage, so the form can
 * show real progress instead of an indefinite spinner — supplier documents are
 * often multi-megabyte phone photos on slow mobile networks.
 */
export async function applyAsSupplier(
  payload: FormData,
  onUploadProgress?: (percent: number) => void
): Promise<{ supplierProfile: SupplierProfile }> {
  return apiUploadWithProgress('/suppliers/apply', payload, onUploadProgress)
}

/**
 * Get the current user's supplier application status.
 * "No application yet" is a valid state, and the backend answers 200 with
 * `supplierProfile: null` for it (a 404 is also tolerated for older builds).
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
 * Build the TravioAfrica-Supplier SSO login URL for an approved supplier.
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
