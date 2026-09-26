/**
 * Supplier registration wizard — option lists, supplier-type mapping,
 * per-step validation and the `POST /suppliers/apply` payload builder.
 *
 * The UI-shaped form model lives in `supplierApplicationDraft.ts`; this module
 * is the bridge between that model and the backend contract
 * (supplierController.applyToBeSupplier): four JSON sections + supplierType +
 * documents/documentMeta as multipart/form-data.
 *
 * The wizard's step indexes are stable (drafts persist them):
 *   0 account · 1 type · 2 profile · 3 services · 4 verification · 5 payout ·
 *   6 review · (7 = success screen, not a form step)
 *
 * @see lib/supplierApplicationDraft.ts
 * @see components/supplier/SupplierApplicationForm.tsx
 */
import type { SupplierApplicationForm } from './supplierApplicationDraft'
import { DEFAULT_COUNTRY_CODE, buildE164Phone, isValidPhoneInput } from './phone'
import { sanitizeSocialLinks } from './socialLinks'
import type { LucideIcon } from 'lucide-react'
import {
  Building2,
  Bus,
  Calendar,
  CalendarDays,
  CalendarRange,
  CarFront,
  CarTaxiFront,
  Compass,
  Landmark,
  Map as MapIcon,
  Plane,
  Smartphone,
  Sparkles,
  Store,
  Ticket,
  Wallet,
} from 'lucide-react'

export const STEP_ACCOUNT = 0
export const STEP_TYPE = 1
export const STEP_PROFILE = 2
export const STEP_SERVICES = 3
export const STEP_VERIFICATION = 4
export const STEP_PAYOUT = 5
export const STEP_REVIEW = 6
/** Success screen — rendered instead of a form step after a successful submit. */
export const STEP_SUCCESS = 7
export const STEPS_COUNT = 7

const CURRENT_YEAR = new Date().getFullYear()

// ── Supplier type cards ───────────────────────────────────────────────────

export type SupplierKind = 'business' | 'individual'

export interface SupplierTypeOption {
  /** Stable key persisted in `form.supplierChoice`. */
  id: string
  label: string
  description: string
  /** Drives the individual/business profile form and verification copy. */
  kind: SupplierKind
  /** Value for the `supplierType` field (Prisma SupplierType enum). */
  supplierType: string
  /** Value for `businessInfo.businessType`. */
  businessType: 'company' | 'individual'
  /** Card icon (lucide-react — the icon set the rest of the site uses). */
  icon: LucideIcon
}

/**
 * The supplier-type cards, with the explicit mapping layer to the backend's
 * SupplierType enum. Accommodation providers are not offered here (the card was
 * removed), so `ACCOMMODATION_PROVIDER` is no longer selectable in this flow —
 * the enum stays valid for existing profiles and other onboarding paths.
 */
export const SUPPLIER_TYPE_OPTIONS: SupplierTypeOption[] = [
  {
    id: 'registered_company',
    label: 'Registered Company',
    description: 'A registered tour operator, company or organisation.',
    kind: 'business',
    supplierType: 'TOUR_COMPANY',
    businessType: 'company',
    icon: Building2,
  },
  {
    id: 'sole_proprietor',
    label: 'Sole Proprietor / Business',
    description: 'You operate under a business or trading name.',
    kind: 'business',
    supplierType: 'TOUR_COMPANY',
    businessType: 'individual',
    icon: Store,
  },
  {
    id: 'individual_guide',
    label: 'Individual Tour Guide',
    description: 'You personally lead tours and experiences.',
    kind: 'individual',
    supplierType: 'TOUR_GUIDE',
    businessType: 'individual',
    icon: Compass,
  },
  {
    id: 'experience_host',
    label: 'Independent Experience Host',
    description: 'You run activities or local experiences independently.',
    kind: 'individual',
    supplierType: 'OTHER_SERVICE_PROVIDER',
    businessType: 'individual',
    icon: Sparkles,
  },
  {
    id: 'transport_company',
    label: 'Transport Company',
    description: 'You provide airport transfers, private transport or fleet services.',
    kind: 'business',
    supplierType: 'TRANSPORTATION_PROVIDER',
    businessType: 'company',
    icon: Bus,
  },
  {
    id: 'independent_driver',
    label: 'Independent Driver',
    description: 'You personally provide transport or transfer services.',
    kind: 'individual',
    supplierType: 'VEHICLE_OPERATOR',
    businessType: 'individual',
    icon: CarFront,
  },
]

export function supplierTypeOption(id?: string | null): SupplierTypeOption | null {
  if (!id) return null
  return SUPPLIER_TYPE_OPTIONS.find((option) => option.id === id) ?? null
}

// ── Regions ───────────────────────────────────────────────────────────────

/** Ghana's 16 regions (profile address + operating-region pills). */
export const GHANA_REGIONS: string[] = [
  'Greater Accra',
  'Ashanti',
  'Central',
  'Eastern',
  'Western',
  'Western North',
  'Volta',
  'Oti',
  'Northern',
  'North East',
  'Savannah',
  'Upper East',
  'Upper West',
  'Bono',
  'Bono East',
  'Ahafo',
]

// ── Service cards ─────────────────────────────────────────────────────────

export interface ServiceOption {
  /** Persisted in `form.services`. */
  id: string
  label: string
  description: string
  /** Drives "what may be asked for later" on the verification step. */
  group: 'tours' | 'transport' | 'experience'
  icon: LucideIcon
}

export const SERVICE_OPTIONS: ServiceOption[] = [
  {
    id: 'tours',
    label: 'Tours & Activities',
    description: 'City tours, day trips, cultural experiences, nature and adventure activities.',
    group: 'tours',
    icon: MapIcon,
  },
  {
    id: 'airport_transfers',
    label: 'Airport Transfers',
    description: 'Airport pickup, drop-off and return transfers.',
    group: 'transport',
    icon: Plane,
  },
  {
    id: 'private_transport',
    label: 'Private Transport',
    description: 'Private driver, chauffeur and point-to-point transport.',
    group: 'transport',
    icon: CarTaxiFront,
  },
  {
    id: 'other_experience',
    label: 'Other Experience',
    description: 'Food, workshops, events or another bookable service.',
    group: 'experience',
    icon: Ticket,
  },
]

function selectedServices(ids: string[]): ServiceOption[] {
  return SERVICE_OPTIONS.filter((option) => ids.includes(option.id))
}

/** Tours/activities-style offerings (incl. "Other Experience"). */
export function hasToursService(ids: string[]): boolean {
  return selectedServices(ids).some((option) => option.group === 'tours' || option.group === 'experience')
}

export function hasTransportService(ids: string[]): boolean {
  return selectedServices(ids).some((option) => option.group === 'transport')
}

export function serviceLabels(ids: string[]): string[] {
  return selectedServices(ids).map((option) => option.label)
}

// ── Payout options ────────────────────────────────────────────────────────

export type PayoutMethodId = 'bank' | 'paypal' | 'momo'
export type PayoutScheduleId = 'weekly' | 'twice_monthly' | 'monthly'

export interface PayoutMethodOption {
  id: PayoutMethodId
  label: string
  description: string
  icon: LucideIcon
}

export const PAYOUT_METHODS: PayoutMethodOption[] = [
  {
    id: 'bank',
    label: 'Bank Transfer',
    description: 'Receive your earnings directly into your bank account.',
    icon: Landmark,
  },
  {
    id: 'paypal',
    label: 'PayPal',
    description: 'Receive payouts through your PayPal account.',
    icon: Wallet,
  },
  {
    id: 'momo',
    label: 'Mobile Money',
    description: 'Receive payouts directly to your Ghana mobile money wallet.',
    icon: Smartphone,
  },
]

export interface PayoutScheduleOption {
  id: PayoutScheduleId
  label: string
  /** Bold lead line inside the card body. */
  lead: string
  description: string
  /** Value written to `payoutInfo.schedule`. */
  backendValue: string
  icon: LucideIcon
}

export const PAYOUT_SCHEDULES: PayoutScheduleOption[] = [
  {
    id: 'weekly',
    label: 'Weekly',
    lead: 'Every Monday',
    description: 'Payouts are generated every Monday for eligible experiences completed by the Sunday before.',
    backendValue: 'WEEKLY',
    icon: CalendarDays,
  },
  {
    id: 'twice_monthly',
    label: 'Twice a month',
    lead: 'The 1st and 15th of each month',
    description: 'Payouts are generated twice a month, on the 1st and the 15th.',
    backendValue: 'TWICE_MONTHLY',
    icon: CalendarRange,
  },
  {
    id: 'monthly',
    label: 'Monthly',
    lead: 'The 1st of each month',
    description: 'One payout a month, generated on the 1st for the previous month.',
    backendValue: 'MONTHLY',
    icon: Calendar,
  },
]

export const MOMO_NETWORKS: string[] = ['MTN Mobile Money', 'Telecel Cash', 'AT Money']

export const PAYOUT_CURRENCIES: string[] = ['GHS', 'USD', 'GBP', 'EUR']

// ── Identity documents ────────────────────────────────────────────────────

export interface IdTypeOption {
  /** Stored in `profile.idType`. */
  value: string
  label: string
}

export const ID_TYPE_OPTIONS: IdTypeOption[] = [
  { value: 'national_id', label: 'Ghana Card' },
  { value: 'passport', label: 'Passport' },
  { value: 'other_government_id', label: 'Other government-issued ID' },
]

export function idTypeLabel(value?: string | null): string {
  if (!value) return ''
  return ID_TYPE_OPTIONS.find((option) => option.value === value)?.label ?? value
}

/**
 * The identity document required up front for every supplier type. Business
 * types must also attach a business registration certificate — see
 * `requiredSupplierDocuments`.
 */
export function primaryDocumentType(): string {
  return 'GHANA_CARD'
}

/** One document that must be uploaded before the application can be submitted. */
export interface RequiredSupplierDocument {
  /** `documentMeta.type` sent to the backend (Prisma DocumentType). */
  type: string
  title: string
  description: string
  uploadLabel: string
}

const ID_DOCUMENT: RequiredSupplierDocument = {
  type: primaryDocumentType(),
  title: 'Government-issued ID',
  description:
    'Upload one Ghana Card, passport or another accepted government-issued ID. Your name and date of birth should match your profile.',
  uploadLabel: 'Upload your ID',
}

const BUSINESS_CERTIFICATE_DOCUMENT: RequiredSupplierDocument = {
  type: 'BUSINESS_CERTIFICATE',
  title: 'Business registration certificate',
  description:
    'Upload your business registration certificate from the Registrar General (or your business trading certificate). The name on it should match the business name on your application.',
  uploadLabel: 'Upload your certificate',
}

/**
 * Documents that must be attached at the verification step, per supplier type.
 *
 * Every supplier uploads a photo of a government-issued ID. Registered
 * companies, sole proprietors / businesses and transport companies must also
 * attach their business registration certificate up front; the individual
 * types (tour guide, experience host, independent driver) do not.
 */
export function requiredSupplierDocuments(
  choiceId: string | null | undefined
): RequiredSupplierDocument[] {
  const option = supplierTypeOption(choiceId)
  const kind: SupplierKind = option?.kind ?? 'individual'
  return kind === 'business' ? [ID_DOCUMENT, BUSINESS_CERTIFICATE_DOCUMENT] : [ID_DOCUMENT]
}

export interface LaterDocument {
  name: string
  detail: string
}

/**
 * Documents TravioGhana may ask for before a listing (or service) goes live —
 * ported from the prototype's `updateVerificationRequirements()`. Returns an
 * empty list when nothing extra applies ("No extra documents right now").
 */
export function laterDocumentsFor(choiceId: string | null | undefined, services: string[]): LaterDocument[] {
  const option = supplierTypeOption(choiceId)
  const kind: SupplierKind = option?.kind ?? 'individual'
  const label = option?.label ?? ''
  const hasTours = hasToursService(services)
  const hasTransport = hasTransportService(services)
  const isIndividual = kind === 'individual'
  const isIndependentDriver = label === 'Independent Driver'
  const isTransportCompany = label === 'Transport Company'
  const isRegisteredCompany = label === 'Registered Company'

  const docs: LaterDocument[] = []
  const add = (name: string, detail: string) => docs.push({ name, detail })

  if (isIndividual && hasTours && !isIndependentDriver) {
    add('Ghana Tourism Authority licence', 'May be requested before applicable tours or experiences go live.')
  }

  if (!isIndividual && hasTours) {
    add('Ghana Tourism Authority licence', 'May be required before applicable tour listings go live.')
    add('Public liability / activity insurance', 'May be required for applicable tours or activities before publishing.')
  }

  if (isIndependentDriver) {
    add("Driver's licence", 'Required before transport services or vehicle-based tours become bookable.')
    add('Vehicle registration', 'Required for the vehicle used to fulfil bookings.')
    add('Vehicle insurance', 'Required before the vehicle becomes active on TravioGhana.')
    add('Roadworthiness', 'Required where applicable before the vehicle becomes active.')
  } else if (isTransportCompany) {
    add("Driver's licence", 'Add driver documents when assigning drivers to TravioGhana bookings.')
    add('Vehicle registration', 'Add registration documents for vehicles used on TravioGhana.')
    add('Vehicle insurance', 'Required for vehicles used to fulfil bookings.')
    add('Roadworthiness', 'Required where applicable for active vehicles.')
  } else if (isRegisteredCompany && hasTransport) {
    add('Vehicle registration', 'May be requested before Airport Transfer or Private Transport listings go live.')
    add('Vehicle insurance', 'May be requested before the vehicle is used for Travio bookings.')
  } else if (hasTransport) {
    add('Vehicle / driver documents', 'TravioGhana may request the relevant transport documents before the service goes live.')
  }

  return docs
}

// ── Small helpers ─────────────────────────────────────────────────────────

export function normalizeWebsite(url: string): string {
  if (!url || typeof url !== 'string') return ''
  const trimmed = url.trim()
  if (!trimmed) return ''
  if (/^https?:\/\//i.test(trimmed)) return trimmed
  return `https://${trimmed}`
}

/** Years operating, derived from the profile's "year established". */
export function yearsInBusinessFrom(yearEstablished: string): number {
  const year = Number.parseInt(String(yearEstablished ?? ''), 10)
  if (!Number.isFinite(year) || year <= 0) return 0
  return Math.max(0, CURRENT_YEAR - year)
}

export function splitFullName(name?: string | null): { firstName: string; lastName: string } {
  const parts = String(name ?? '').trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return { firstName: '', lastName: '' }
  const [firstName, ...rest] = parts
  return { firstName, lastName: rest.join(' ') }
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export function isValidEmail(value: string): boolean {
  return EMAIL_RE.test(value.trim())
}

function digits(value: string): number {
  return (value.match(/\d/g) || []).length
}

function isEmpty(value: unknown): boolean {
  return (
    value === undefined ||
    value === null ||
    (typeof value === 'string' && !value.trim()) ||
    (Array.isArray(value) && value.length === 0) ||
    (typeof value === 'boolean' && !value)
  )
}

// ── Step validation ───────────────────────────────────────────────────────

export interface StepValidationContext {
  /**
   * The visitor already has an account session — the password fields are not
   * rendered, so password rules are skipped.
   */
  hasSession: boolean
  password: string
  confirmPassword: string
}

export const EMPTY_VALIDATION_CONTEXT: StepValidationContext = {
  hasSession: true,
  password: '',
  confirmPassword: '',
}

/**
 * Validate one wizard step.
 * @returns Field path → message (empty object = valid). The paths match the
 *   `data-field` attributes so the form can scroll to and focus the first
 *   offending control.
 */
export function validateSupplierStep(
  step: number,
  form: SupplierApplicationForm,
  ctx: StepValidationContext = EMPTY_VALIDATION_CONTEXT
): Record<string, string> {
  const errors: Record<string, string> = {}

  if (step === STEP_ACCOUNT) {
    const account = form.account
    if (isEmpty(account.firstName)) errors['account.firstName'] = 'First name is required'
    if (isEmpty(account.lastName)) errors['account.lastName'] = 'Last name is required'
    if (isEmpty(account.email)) {
      errors['account.email'] = 'Email address is required'
    } else if (!isValidEmail(account.email)) {
      errors['account.email'] = 'Enter a valid email address'
    }
    // Validated with libphonenumber-js against the selected calling code —
    // the same check the booking checkout uses.
    if (isEmpty(account.phone)) {
      errors['account.phone'] = 'Phone / WhatsApp number is required'
    } else if (!isValidPhoneInput(account.phoneCountryCode || DEFAULT_COUNTRY_CODE, account.phone)) {
      errors['account.phone'] = 'Enter a valid phone number for the selected country, e.g. 024 123 4567'
    }

    // Signed-out applicants must create the account's password. A signed-in
    // social-login applicant may optionally add one — but then it must be valid.
    const passwordProvided = Boolean(ctx.password || ctx.confirmPassword)
    if (!ctx.hasSession || passwordProvided) {
      if (!ctx.password) {
        errors['account.password'] = ctx.hasSession
          ? 'Enter the password you want to use'
          : 'Create a password for your supplier account'
      } else if (ctx.password.length < 8) {
        errors['account.password'] = 'Password must be at least 8 characters'
      }
      if (!ctx.confirmPassword) {
        errors['account.confirmPassword'] = 'Confirm your password'
      } else if (ctx.confirmPassword !== ctx.password) {
        errors['account.confirmPassword'] = 'Passwords do not match'
      }
    }
  }

  if (step === STEP_TYPE) {
    if (!supplierTypeOption(form.supplierChoice)) {
      errors['supplierChoice'] = 'Select the option that best describes you'
    }
  }

  if (step === STEP_PROFILE) {
    const option = supplierTypeOption(form.supplierChoice)
    if (!option) {
      errors['supplierChoice'] = 'Go back and select your supplier type first'
    } else if (option.kind === 'individual') {
      const p = form.profile
      if (isEmpty(p.firstName)) errors['profile.firstName'] = 'First name is required'
      if (isEmpty(p.lastName)) errors['profile.lastName'] = 'Last name is required'
      if (isEmpty(p.dateOfBirth)) errors['profile.dateOfBirth'] = 'Date of birth is required'
      if (isEmpty(p.idType)) errors['profile.idType'] = 'ID type is required'
      if (isEmpty(p.idNumber)) errors['profile.idNumber'] = 'ID number is required'
      if (isEmpty(p.brandName)) errors['profile.brandName'] = 'Business / brand name is required'
    } else {
      const p = form.profile
      if (isEmpty(p.brandName)) errors['profile.brandName'] = 'Business / brand name is required'
      if (isEmpty(p.legalBusinessName)) errors['profile.legalBusinessName'] = 'Legal business name is required'
      if (isEmpty(p.registrationNumber)) errors['profile.registrationNumber'] = 'Business registration number is required'
      const year = Number.parseInt(p.yearEstablished, 10)
      if (isEmpty(p.yearEstablished)) {
        errors['profile.yearEstablished'] = 'Year established is required'
      } else if (!Number.isFinite(year) || year < 1900 || year > CURRENT_YEAR + 1) {
        errors['profile.yearEstablished'] = `Enter a year between 1900 and ${CURRENT_YEAR + 1}`
      }
      if (!form.taxAcknowledged) {
        errors['taxAcknowledged'] = 'Please confirm the tax responsibility acknowledgement'
      }
    }

    if (isEmpty(form.profile.address)) errors['profile.address'] = 'Address / GhanaPost GPS is required'
    if (isEmpty(form.profile.region)) errors['profile.region'] = 'Region is required'
    if (isEmpty(form.profile.city)) errors['profile.city'] = 'City / town is required'
    if (form.operatingRegions.length === 0) {
      errors['operatingRegions'] = 'Select at least one region where you mainly operate'
    }
  }

  if (step === STEP_SERVICES && form.services.length === 0) {
    errors['services'] = 'Select at least one service you want to sell'
  }

  if (step === STEP_VERIFICATION) {
    const required = requiredSupplierDocuments(form.supplierChoice)
    const missing = required.filter(
      (req) =>
        !form.verificationDocuments.some(
          (doc) => doc.ownerType === 'SUPPLIER' && doc.type === req.type && doc.file
        )
    )
    if (missing.length > 0) {
      errors['verificationDocuments'] =
        `Upload the required document${missing.length > 1 ? 's' : ''}: ${missing.map((doc) => doc.title).join(', ')}`
    }
  }

  if (step === STEP_PAYOUT) {
    const payout = form.payout
    if (payout.method === 'paypal' && payout.paypalEmail.trim() && !isValidEmail(payout.paypalEmail)) {
      errors['payout.paypalEmail'] = 'Enter a valid PayPal email address'
    }
    if (payout.method === 'momo' && payout.momoNumber.trim() && digits(payout.momoNumber) < 9) {
      errors['payout.momoNumber'] = 'Enter a valid mobile money number'
    }
  }

  if (step === STEP_REVIEW && !form.compliance.acceptedTerms) {
    errors['compliance.acceptedTerms'] = 'You must accept the supplier standards to submit'
  }

  return errors
}

// ── Payload builder ───────────────────────────────────────────────────────

/**
 * Build the multipart payload for `POST /suppliers/apply`.
 *
 * Shape mirrors the backend contract: `supplierType` + four JSON-string
 * sections (businessInfo, operatingInfo, representativeInfo, payoutInfo) +
 * compliance, with each uploaded file paired with a `documentMeta` entry.
 * Keys are chosen to match what TravioGhana-Admin's SupplierDetail screen
 * reads (e.g. payoutInfo.bankAccountNumber / payoutCurrency,
 * operatingInfo.regions, representativeInfo.fullName).
 */
export function buildSupplierPayload(form: SupplierApplicationForm): FormData {
  const option = supplierTypeOption(form.supplierChoice)
  const kind: SupplierKind = option?.kind ?? 'individual'
  const isBusiness = kind === 'business'
  const { account, profile } = form

  const payload = new FormData()

  payload.append('supplierType', option?.supplierType ?? 'TOUR_COMPANY')

  const fullName =
    [account.firstName, account.lastName].filter(Boolean).join(' ').trim() ||
    [profile.firstName, profile.lastName].filter(Boolean).join(' ').trim()

  // Store the phone as a canonical international number so operators and
  // booking emails can dial it without knowing the supplier's country code.
  const fullPhone =
    buildE164Phone(account.phoneCountryCode || DEFAULT_COUNTRY_CODE, account.phone) ?? account.phone

  payload.append(
    'businessInfo',
    JSON.stringify({
      legalBusinessName: isBusiness ? profile.legalBusinessName : profile.brandName,
      displayName: profile.brandName,
      businessType: option?.businessType ?? 'individual',
      country: 'GH',
      phoneNumber: fullPhone,
      address: {
        line1: profile.address,
        line2: '',
        city: profile.city,
        state: profile.region,
        postalCode: '',
      },
      website: normalizeWebsite(profile.website),
      // Social links persist under their platform keys (twitter, instagram,
      // …) — the same shape the supplier platform settings screen writes.
      ...sanitizeSocialLinks(profile.socialLinks),
      ...(profile.tin ? { tin: profile.tin } : {}),
      ...(isBusiness && profile.registrationNumber
        ? { registrationNumber: profile.registrationNumber }
        : {}),
      ...(isBusiness && profile.yearEstablished
        ? { yearEstablished: Number.parseInt(profile.yearEstablished, 10) || null }
        : {}),
    })
  )

  payload.append(
    'operatingInfo',
    JSON.stringify({
      regions: form.operatingRegions,
      services: serviceLabels(form.services),
      // TravioGhana-Admin renders `tourCategories` as the supplier's offering
      // chips; the wizard's service cards are exactly those categories, so the
      // reviewer sees what the supplier sells instead of "Not provided".
      tourCategories: serviceLabels(form.services),
      yearsInBusiness: isBusiness ? yearsInBusinessFrom(profile.yearEstablished) : 0,
    })
  )

  payload.append(
    'representativeInfo',
    JSON.stringify({
      fullName,
      email: account.email.trim(),
      phoneNumber: fullPhone,
      ...(profile.dateOfBirth ? { dateOfBirth: profile.dateOfBirth } : {}),
      ...(profile.idType ? { idType: idTypeLabel(profile.idType) } : {}),
      ...(profile.idNumber ? { idNumber: profile.idNumber } : {}),
      address: {
        line1: profile.address,
        line2: '',
        city: profile.city,
        state: profile.region,
        postalCode: '',
      },
    })
  )

  const payout = form.payout
  payload.append(
    'payoutInfo',
    JSON.stringify({
      method: payout.method,
      schedule: PAYOUT_SCHEDULES.find((schedule) => schedule.id === payout.schedule)?.backendValue ?? 'WEEKLY',
      bankAccountName: payout.bankAccountName,
      bankAccountNumber: payout.bankAccountNumber,
      bankName: payout.bankName,
      bankCountry: payout.bankCountry,
      payoutCurrency: payout.currency,
      paypalAccountName: payout.paypalAccountName,
      paypalEmail: payout.paypalEmail,
      momoAccountName: payout.momoAccountName,
      momoNetwork: payout.momoNetwork,
      momoNumber: payout.momoNumber,
    })
  )

  payload.append(
    'compliance',
    JSON.stringify({
      acceptedTerms: form.compliance.acceptedTerms,
      agreedToPayoutTerms: form.compliance.agreedToPayoutTerms,
      // The review step's "information processing & verification" standard.
      privacyAccepted: form.compliance.acceptedTerms,
      // Keys TravioGhana-Admin's compliance checklist reads — the standards the
      // applicant accepts cover the code of conduct and data processing, so
      // they must not show as unaccepted (red X) in the review screen.
      codeOfConductAccepted: form.compliance.acceptedTerms,
      dataProcessingAccepted: form.compliance.acceptedTerms,
      taxAcknowledged: form.taxAcknowledged,
    })
  )

  const documentMeta: { type: string; ownerType: string }[] = []
  for (const doc of form.verificationDocuments) {
    if (!doc.file) continue
    payload.append('documents', doc.file)
    documentMeta.push({ type: doc.type, ownerType: doc.ownerType })
  }
  if (documentMeta.length > 0) {
    payload.append('documentMeta', JSON.stringify(documentMeta))
  }

  return payload
}
