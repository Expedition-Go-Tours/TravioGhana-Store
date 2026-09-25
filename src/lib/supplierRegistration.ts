/**
 * Supplier registration wizard — validation and payload mapping.
 *
 * The wizard's fields map onto the existing POST /suppliers/apply contract
 * (multipart FormData, JSON sections as string fields — see lib/supplier.ts).
 * Fields the new design does not collect are sent as documented defaults or as
 * extra keys inside the existing JSON sections, so the backend keeps receiving
 * every field it knows about.
 */
import {
  SERVICE_CARDS,
  GHANA_REGIONS,
  supplierCard,
  ID_TYPE_OPTIONS,
  type ServiceGroup,
} from '@/components/supplier/registrationConfig'
import type { SupplierRegistrationForm } from '@/lib/supplierApplicationDraft'

export interface RegistrationValidationContext {
  /** True when the visitor already has a session — password fields are hidden. */
  signedIn: boolean
  password?: string
  confirmPassword?: string
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

function isBlank(value: string | undefined | null): boolean {
  return !value || !value.trim()
}

/**
 * @returns An error message for the first problem on the step, or null.
 */
export function validateRegistrationStep(
  step: number,
  form: SupplierRegistrationForm,
  ctx: RegistrationValidationContext
): string | null {
  if (step === 0) {
    if (isBlank(form.account.firstName)) return 'First name is required'
    if (isBlank(form.account.lastName)) return 'Last name is required'
    if (isBlank(form.account.email)) return 'Email address is required'
    if (!EMAIL_RE.test(form.account.email.trim())) return 'Enter a valid email address'
    if (isBlank(form.account.phone)) return 'Phone / WhatsApp number is required'
    if (!ctx.signedIn) {
      const password = ctx.password ?? ''
      if (password.length < 8) return 'Create a password with at least 8 characters'
      if (password !== (ctx.confirmPassword ?? '')) return 'Passwords do not match'
    }
    return null
  }

  if (step === 1) {
    if (!form.supplierCardId) return 'Select how you are joining TravioGhana'
    return null
  }

  if (step === 2) {
    if (form.supplierKind === 'individual') {
      const p = form.individual
      if (isBlank(p.firstName)) return 'First name is required'
      if (isBlank(p.lastName)) return 'Last name is required'
      if (isBlank(p.dob)) return 'Date of birth is required'
      if (isBlank(p.idType)) return 'ID type is required'
      if (isBlank(p.idNumber)) return 'ID number is required'
      if (isBlank(p.address)) return 'Address / GhanaPost GPS is required'
      if (isBlank(p.region)) return 'Region is required'
      if (isBlank(p.city)) return 'City / Town is required'
      if (isBlank(p.brandName)) return 'Business / brand name is required'
    } else {
      const b = form.business
      if (isBlank(b.brandName)) return 'Business / brand name is required'
      const year = parseInt(b.yearEstablished, 10)
      if (!year || year < 1900 || year > 2100) return 'Enter a valid year established'
      if (isBlank(b.legalName)) return 'Legal business name is required'
      if (isBlank(b.regNumber)) return 'Business registration number is required'
      if (isBlank(b.address)) return 'Business address / GhanaPost GPS is required'
      if (isBlank(b.region)) return 'Region is required'
      if (isBlank(b.city)) return 'City / Town is required'
      if (!b.taxAck) return 'Please confirm the tax responsibility acknowledgement'
    }
    if (form.operatingRegions.length === 0) return 'Select at least one region'
    return null
  }

  if (step === 3) {
    // Services are optional at registration — the reference lets suppliers skip
    // and pick what to sell from the dashboard.
    return null
  }

  if (step === 4) {
    if (!form.primaryDocument) return 'Upload the required document to continue'
    return null
  }

  if (step === 5) {
    // Payout details can be completed later, as labelled throughout the step.
    return null
  }

  if (step === 6) {
    if (!form.compliance.acceptAll) return 'Please review and accept the supplier standards'
    return null
  }

  return null
}

/** First step (0-6) that fails validation, or null when the whole form is valid. */
export function firstInvalidStep(
  form: SupplierRegistrationForm,
  ctx: RegistrationValidationContext
): number | null {
  for (let step = 0; step <= 6; step++) {
    if (validateRegistrationStep(step, form, ctx)) return step
  }
  return null
}

export function selectedServiceGroups(services: string[]): ServiceGroup[] {
  const groups = new Set<ServiceGroup>()
  for (const card of SERVICE_CARDS) {
    if (services.includes(card.id)) groups.add(card.group)
  }
  return [...groups]
}

function normalizeWebsite(url: string): string {
  const trimmed = (url || '').trim()
  if (!trimmed) return ''
  if (/^https?:\/\//i.test(trimmed)) return trimmed
  return `https://${trimmed}`
}

function idTypeToBackend(value: string): string {
  if (value === ID_TYPE_OPTIONS[0]) return 'national_id'
  if (value === ID_TYPE_OPTIONS[1]) return 'passport'
  return 'other'
}

/** Known regions keep their reference casing; anything else passes through. */
function normalizeRegion(value: string): string {
  const match = GHANA_REGIONS.find((r) => r.toLowerCase() === value.trim().toLowerCase())
  return match ?? value.trim()
}

function payoutCurrency(form: SupplierRegistrationForm): string {
  if (form.payout.method === 'bank') return form.payout.bank.currency || 'GHS'
  if (form.payout.method === 'momo') return form.payout.momo.currency || 'GHS'
  return form.payout.paypal.email ? 'GHS' : ''
}

/**
 * Build the multipart payload for POST /suppliers/apply.
 */
export function buildSupplierApplicationFormData(form: SupplierRegistrationForm): FormData {
  const card = supplierCard(form.supplierCardId)
  const kind = form.supplierKind || card?.kind || 'business'
  const isIndividual = kind === 'individual'
  const groups = selectedServiceGroups(form.services)

  const profile = isIndividual ? form.individual : form.business
  const line1 = profile.address
  const region = normalizeRegion(profile.region)
  const city = profile.city
  const brandName = profile.brandName || `${form.account.firstName} ${form.account.lastName}`.trim()
  const website = normalizeWebsite(form.business.website)

  const yearEstablished = parseInt(form.business.yearEstablished, 10)
  const yearsInBusiness =
    Number.isFinite(yearEstablished) && yearEstablished > 0
      ? Math.max(0, new Date().getFullYear() - yearEstablished)
      : 0

  const categories = SERVICE_CARDS.filter(
    (c) => form.services.includes(c.id) && c.group !== 'transport'
  ).map((c) => c.title)

  const representativeName = isIndividual
    ? `${form.individual.firstName} ${form.individual.lastName}`.trim()
    : `${form.account.firstName} ${form.account.lastName}`.trim()

  const payload = new FormData()

  payload.append('supplierType', card?.backendType ?? 'OTHER_SERVICE_PROVIDER')

  payload.append(
    'businessInfo',
    JSON.stringify({
      legalBusinessName: isIndividual ? brandName : form.business.legalName || brandName,
      displayName: brandName,
      businessType: isIndividual ? 'individual' : form.supplierCardId === 'sole_proprietor' ? 'sole_proprietor' : 'company',
      country: 'GH',
      address: { line1, line2: '', city, state: region, postalCode: '' },
      website,
      phoneNumber: form.account.phone.trim(),
      // Extra context for the review team (the new design's finer categories).
      supplierCategory: form.supplierCardId,
      supplierKind: kind,
      registrationNumber: form.business.regNumber.trim(),
      tin: form.business.tin.trim(),
      socialMedia: form.business.social.trim(),
      yearEstablished: Number.isFinite(yearEstablished) ? yearEstablished : null,
      taxResponsibilityAcknowledged: Boolean(form.business.taxAck),
    })
  )

  payload.append(
    'operatingInfo',
    JSON.stringify({
      tourCategories: categories,
      destinations: form.operatingRegions.map(normalizeRegion),
      languages: ['English'],
      yearsInBusiness,
      cancellationPolicy: '',
      meetingStyle: '',
      /** ServiceCard ids the supplier picked (new-design field). */
      services: form.services,
      serviceGroups: groups,
    })
  )

  payload.append(
    'representativeInfo',
    JSON.stringify({
      fullName: representativeName,
      email: form.account.email.trim(),
      dateOfBirth: isIndividual ? form.individual.dob : '',
      address: { line1, line2: '', city, state: region, postalCode: '' },
      idType: isIndividual ? idTypeToBackend(form.individual.idType) : '',
      idNumber: isIndividual ? form.individual.idNumber.trim() : '',
      phoneNumber: form.account.phone.trim(),
    })
  )

  payload.append(
    'payoutInfo',
    JSON.stringify({
      bankAccountName: form.payout.bank.accountName.trim(),
      bankCountry: form.payout.bank.bankCountry.trim(),
      payoutCurrency: payoutCurrency(form),
      // New-design payout fields.
      payoutMethod: form.payout.method,
      payoutSchedule: form.payout.schedule,
      primaryPayoutMethod: form.payout.primary,
      bankAccountNumber: form.payout.bank.accountNumber.trim(),
      bankName: form.payout.bank.bankName.trim(),
      paypalAccountName: form.payout.paypal.accountName.trim(),
      paypalEmail: form.payout.paypal.email.trim(),
      momoAccountName: form.payout.momo.accountName.trim(),
      momoNetwork: form.payout.momo.network.trim(),
      momoNumber: form.payout.momo.number.trim(),
    })
  )

  payload.append(
    'compliance',
    JSON.stringify({
      acceptedTerms: true,
      agreedToPayoutTerms: true,
      supplierStandardsAccepted: Boolean(form.compliance.acceptAll),
    })
  )

  if (form.primaryDocument) {
    payload.append('documents', form.primaryDocument)
    payload.append(
      'documentMeta',
      JSON.stringify([{ type: isIndividual ? 'GHANA_CARD' : 'BUSINESS_CERTIFICATE', ownerType: 'SUPPLIER' }])
    )
  }

  return payload
}
