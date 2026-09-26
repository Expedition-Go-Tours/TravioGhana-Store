/**
 * Persists in-progress supplier registration in sessionStorage and localStorage.
 *   sessionStorage: same-tab refresh; cleared when the tab closes.
 *   localStorage: survives new tabs and browser restarts.
 *   On load, the draft with the latest updatedAt wins.
 *   Drafts stay keyed to the last signed-in user after logout (localStorage last-user pointer).
 *
 * Storage keys are versioned (`…:v2:`) because the wizard was restructured
 * (6 payload-shaped steps → 7 prototype-shaped steps): a v1 draft's step index
 * and field layout no longer line up, so v1 keys are ignored and cleaned up.
 */
import { sanitizeSocialLinks, type SocialLinks } from './socialLinks'

export interface SupplierApplicationForm {
  /** Supplier-type card chosen on step 2 (mapped to the backend enum on submit). */
  supplierChoice: string
  account: {
    firstName: string
    lastName: string
    email: string
    /** National number, digits only (the booking checkout's shape). */
    phone: string
    /** Country calling code for `phone` (e.g. "+233"). */
    phoneCountryCode: string
  }
  /** Step 3 — individual or business profile (both render the same shape). */
  profile: {
    // Individual identity
    firstName: string
    lastName: string
    dateOfBirth: string
    idType: string
    idNumber: string
    // Business profile
    brandName: string
    legalBusinessName: string
    yearEstablished: string
    website: string
    /** Social links keyed by platform (`twitter`, `instagram`, … → full URL). */
    socialLinks: SocialLinks
    registrationNumber: string
    tin: string
    // Address (both kinds)
    address: string
    region: string
    city: string
  }
  /** Step 4 — service cards the supplier wants to sell. */
  services: string[]
  /** Step 3 — Ghana operating regions pills. */
  operatingRegions: string[]
  /** Step 3 — business-kind tax responsibility acknowledgement. */
  taxAcknowledged: boolean
  /** Step 6 — payout preference (details are optional, per the prototype). */
  payout: {
    method: 'bank' | 'paypal' | 'momo'
    schedule: 'weekly' | 'twice_monthly' | 'monthly'
    bankAccountName: string
    bankAccountNumber: string
    bankName: string
    bankCountry: string
    currency: string
    paypalAccountName: string
    paypalEmail: string
    momoAccountName: string
    momoNetwork: string
    momoNumber: string
  }
  /** UI-only toggle on the payout step. */
  primaryPayoutPreference: boolean
  /**
   * Step 5 — the SUPPLIER-owned documents required up front (an ID for every
   * type, plus a business registration certificate for business types).
   */
  verificationDocuments: VerificationDocumentDraft[]
  compliance: {
    acceptedTerms: boolean
    agreedToPayoutTerms: boolean
  }
}

/** One verification document entry (paired with `documentMeta` on submit). */
export interface VerificationDocumentDraft {
  key: string
  type: string
  ownerType: 'SUPPLIER'
  file: File | null
}

interface StoredDraft {
  step: number
  form: SupplierApplicationForm
  updatedAt: number
}

const DRAFT_PREFIX = 'supplier_application_draft:v2:'
/** Pre-restructure drafts — removed on read/write, never restored. */
const LEGACY_DRAFT_PREFIX = 'supplier_application_draft:'
const LAST_DRAFT_USER_KEY = 'supplier_application_draft_last_user'
const STEPS_COUNT = 7

const STORAGES: { name: string; get: () => Storage }[] = [
  { name: 'session', get: () => sessionStorage },
  { name: 'local', get: () => localStorage },
]

export function createEmptySupplierApplicationForm(): SupplierApplicationForm {
  return {
    supplierChoice: '',
    account: {
      firstName: '',
      lastName: '',
      email: '',
      phone: '',
      phoneCountryCode: '',
    },
    profile: {
      firstName: '',
      lastName: '',
      dateOfBirth: '',
      idType: '',
      idNumber: '',
      brandName: '',
      legalBusinessName: '',
      yearEstablished: '',
      website: '',
      socialLinks: {},
      registrationNumber: '',
      tin: '',
      address: '',
      region: '',
      city: '',
    },
    services: [],
    operatingRegions: [],
    taxAcknowledged: false,
    payout: {
      method: 'bank',
      schedule: 'weekly',
      bankAccountName: '',
      bankAccountNumber: '',
      bankName: '',
      bankCountry: 'Ghana',
      currency: 'GHS',
      paypalAccountName: '',
      paypalEmail: '',
      momoAccountName: '',
      momoNetwork: '',
      momoNumber: '',
    },
    primaryPayoutPreference: true,
    verificationDocuments: [],
    compliance: {
      acceptedTerms: false,
      agreedToPayoutTerms: false,
    },
  }
}

function draftStorageKey(userId?: string | null): string {
  const id = String(userId || '').trim()
  return `${DRAFT_PREFIX}${id || 'anonymous'}`
}

function legacyDraftStorageKey(userId?: string | null): string {
  const id = String(userId || '').trim()
  return `${LEGACY_DRAFT_PREFIX}${id || 'anonymous'}`
}

/** Best-effort removal of pre-restructure drafts (wrong step/field layout). */
function removeLegacyDraft(userId?: string | null): void {
  if (typeof window === 'undefined') return
  const legacy = legacyDraftStorageKey(userId)
  for (const { get } of STORAGES) {
    try {
      get().removeItem(legacy)
    } catch {
      // ignore
    }
  }
}

/** Remember who last saved a draft so logout does not lose progress. */
export function rememberDraftUserId(userId: string): void {
  const id = String(userId || '').trim()
  if (!id || typeof window === 'undefined') return
  try {
    localStorage.setItem(LAST_DRAFT_USER_KEY, id)
  } catch {
    // ignore
  }
}

export function getLastDraftUserId(): string | null {
  if (typeof window === 'undefined') return null
  try {
    return localStorage.getItem(LAST_DRAFT_USER_KEY)?.trim() || null
  } catch {
    return null
  }
}

/**
 * Stable key for load/save — stays on the signed-in user after logout.
 */
export function resolveDraftUserId(
  user:
    | { id?: string; _id?: string; uid?: string; firebaseUid?: string; email?: string }
    | null
    | undefined
): string | null {
  return (
    user?.id ??
    user?._id ??
    user?.uid ??
    user?.firebaseUid ??
    user?.email ??
    getLastDraftUserId() ??
    null
  )
}

/** Promote pre-login (anonymous) draft when the user signs in. */
export function migrateAnonymousDraftToUser(userId: string): void {
  if (!userId || typeof window === 'undefined') return

  const userKey = draftStorageKey(userId)
  const anonKey = draftStorageKey(null)

  let userDraft: StoredDraft | null = null
  let anonDraft: StoredDraft | null = null

  for (const { get } of STORAGES) {
    const storage = get()
    const u = readRawDraft(storage, userKey)
    const a = readRawDraft(storage, anonKey)
    if (u && (!userDraft || u.updatedAt >= userDraft.updatedAt)) userDraft = u
    if (a && (!anonDraft || a.updatedAt >= anonDraft.updatedAt)) anonDraft = a
  }

  if (!anonDraft) return

  const shouldMigrate = !userDraft || anonDraft.updatedAt > userDraft.updatedAt

  if (!shouldMigrate) {
    for (const { get } of STORAGES) {
      try {
        get().removeItem(anonKey)
      } catch {
        // ignore
      }
    }
    return
  }

  const payload: StoredDraft = {
    step: anonDraft.step,
    form: serializeFormForDraft(anonDraft.form),
    updatedAt: Date.now(),
  }

  for (const { get } of STORAGES) {
    writeRawDraft(get(), userKey, payload)
    try {
      get().removeItem(anonKey)
    } catch {
      // ignore
    }
  }
}

/** Strip File objects — they cannot be stored in the browser. */
function serializeFormForDraft(form: SupplierApplicationForm): SupplierApplicationForm {
  return {
    ...form,
    verificationDocuments: form.verificationDocuments.map((d) => ({ ...d, file: null })),
  }
}

function normalizeDraftPayload(parsed: unknown): StoredDraft | null {
  if (!parsed || typeof parsed !== 'object') return null

  const record = parsed as Record<string, unknown>
  const step = Number(record.step)
  const safeStep = Number.isFinite(step) && step >= 0 && step < STEPS_COUNT ? Math.floor(step) : 0
  const updatedAt = Number(record.updatedAt) || 0

  return {
    step: safeStep,
    form: mergeSupplierApplicationDraft(record.form),
    updatedAt,
  }
}

function readRawDraft(storage: Storage, key: string): StoredDraft | null {
  try {
    const raw = storage.getItem(key)
    if (!raw) return null
    return normalizeDraftPayload(JSON.parse(raw))
  } catch {
    return null
  }
}

function writeRawDraft(storage: Storage, key: string, payload: StoredDraft): boolean {
  try {
    storage.setItem(key, JSON.stringify(payload))
    return true
  } catch {
    return false
  }
}

function str(value: unknown, fallback = ''): string {
  return typeof value === 'string' ? value : fallback
}

function strArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((v): v is string => typeof v === 'string') : []
}

export function mergeSupplierApplicationDraft(saved?: unknown): SupplierApplicationForm {
  const empty = createEmptySupplierApplicationForm()
  if (!saved || typeof saved !== 'object') return empty

  const savedForm = saved as Partial<SupplierApplicationForm>

  return {
    supplierChoice: str(savedForm.supplierChoice, empty.supplierChoice),
    account: { ...empty.account, ...pickStrings(savedForm.account, empty.account) },
    profile: {
      ...empty.profile,
      ...pickStrings(savedForm.profile, empty.profile),
      socialLinks: sanitizeSocialLinks((savedForm.profile as { socialLinks?: unknown } | undefined)?.socialLinks),
    },
    services: strArray(savedForm.services),
    operatingRegions: strArray(savedForm.operatingRegions),
    taxAcknowledged: Boolean(savedForm.taxAcknowledged),
    payout: { ...empty.payout, ...pickStrings(savedForm.payout, empty.payout), method: normalizeMethod(savedForm.payout?.method), schedule: normalizeSchedule(savedForm.payout?.schedule) },
    primaryPayoutPreference:
      typeof savedForm.primaryPayoutPreference === 'boolean'
        ? savedForm.primaryPayoutPreference
        : empty.primaryPayoutPreference,
    verificationDocuments: Array.isArray(savedForm.verificationDocuments)
      ? savedForm.verificationDocuments.map((d) => ({ ...d, ownerType: 'SUPPLIER' as const, file: null }))
      : [],
    compliance: { ...empty.compliance, ...savedForm.compliance },
  }
}

/** Keep only string fields (never trust shape blindly from storage). */
function pickStrings<T extends Record<string, unknown>>(saved: unknown, fallback: T): Partial<T> {
  if (!saved || typeof saved !== 'object') return {}
  const out: Record<string, unknown> = {}
  for (const key of Object.keys(fallback)) {
    const value = (saved as Record<string, unknown>)[key]
    if (typeof value === 'string') out[key] = value
    else if (typeof fallback[key as keyof T] === 'boolean' && typeof value === 'boolean') out[key] = value
  }
  return out as Partial<T>
}

function normalizeMethod(value: unknown): 'bank' | 'paypal' | 'momo' {
  return value === 'paypal' || value === 'momo' ? value : 'bank'
}

function normalizeSchedule(value: unknown): 'weekly' | 'twice_monthly' | 'monthly' {
  return value === 'twice_monthly' || value === 'monthly' ? value : 'weekly'
}

/**
 * @returns The latest draft (step + form) for the user, or null.
 */
export function loadSupplierApplicationDraft(
  userId?: string | null
): { step: number; form: SupplierApplicationForm } | null {
  if (typeof window === 'undefined') return null

  removeLegacyDraft(userId)

  const key = draftStorageKey(userId)
  let best: StoredDraft | null = null

  for (const { get } of STORAGES) {
    const draft = readRawDraft(get(), key)
    if (!draft) continue
    if (!best || draft.updatedAt >= best.updatedAt) {
      best = draft
    }
  }

  if (!best) return null

  return { step: best.step, form: best.form }
}

/**
 * Save the in-progress application so a refresh does not lose input.
 */
export function saveSupplierApplicationDraft(
  userId: string | null | undefined,
  draft: { step: number; form: SupplierApplicationForm }
): void {
  if (typeof window === 'undefined') return

  if (userId) rememberDraftUserId(userId)
  removeLegacyDraft(userId)

  const step = Number(draft?.step)
  const safeStep = Number.isFinite(step) && step >= 0 && step < STEPS_COUNT ? Math.floor(step) : 0

  const payload: StoredDraft = {
    step: safeStep,
    form: serializeFormForDraft(draft.form),
    updatedAt: Date.now(),
  }

  const key = draftStorageKey(userId)
  for (const { get } of STORAGES) {
    writeRawDraft(get(), key, payload)
  }
}

/** Remove any saved draft for the user. */
export function clearSupplierApplicationDraft(userId?: string | null): void {
  if (typeof window === 'undefined') return

  for (const key of [draftStorageKey(userId), legacyDraftStorageKey(userId)]) {
    for (const { get } of STORAGES) {
      try {
        get().removeItem(key)
      } catch {
        // ignore
      }
    }
  }
}
