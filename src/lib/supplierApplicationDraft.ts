/**
 * Persists in-progress supplier registration in sessionStorage and localStorage.
 *   sessionStorage: same-tab refresh; cleared when the tab closes.
 *   localStorage: survives new tabs and browser restarts.
 *   On load, the draft with the latest updatedAt wins.
 *   Drafts stay keyed to the last signed-in user after logout (localStorage last-user pointer).
 *
 * The wizard uses an 8-slot step index: 0-6 are the form steps, 7 is the
 * success screen.
 */

export interface PayoutBankDetails {
  accountName: string
  accountNumber: string
  bankName: string
  bankCountry: string
  currency: string
  [key: string]: string
}

export interface PayoutPaypalDetails {
  accountName: string
  email: string
  [key: string]: string
}

export interface PayoutMomoDetails {
  accountName: string
  network: string
  number: string
  currency: string
  [key: string]: string
}

export interface SupplierRegistrationForm {
  account: {
    firstName: string
    lastName: string
    email: string
    phone: string
  }
  /** SupplierCardId from registrationConfig, or ''. */
  supplierCardId: string
  /** 'business' | 'individual' (mirrors the selected card), or ''. */
  supplierKind: string
  individual: {
    firstName: string
    lastName: string
    dob: string
    idType: string
    idNumber: string
    address: string
    region: string
    city: string
    brandName: string
  }
  business: {
    brandName: string
    yearEstablished: string
    website: string
    social: string
    legalName: string
    regNumber: string
    tin: string
    address: string
    region: string
    city: string
    taxAck: boolean
  }
  operatingRegions: string[]
  /** ServiceCard ids from registrationConfig. */
  services: string[]
  payout: {
    method: string
    bank: PayoutBankDetails
    paypal: PayoutPaypalDetails
    momo: PayoutMomoDetails
    schedule: string
    primary: boolean
  }
  compliance: {
    acceptAll: boolean
  }
  /** Not persisted (Files cannot be serialized) — re-uploaded after a reload. */
  primaryDocument: File | null
}

interface StoredDraft {
  step: number
  form: SupplierRegistrationForm
  updatedAt: number
}

const DRAFT_PREFIX = 'supplier_registration_draft:'
const LAST_DRAFT_USER_KEY = 'supplier_registration_draft_last_user'
const STEPS_COUNT = 8

const STORAGES: { name: string; get: () => Storage }[] = [
  { name: 'session', get: () => sessionStorage },
  { name: 'local', get: () => localStorage },
]

export function createEmptySupplierRegistrationForm(): SupplierRegistrationForm {
  return {
    account: { firstName: '', lastName: '', email: '', phone: '' },
    supplierCardId: '',
    supplierKind: '',
    individual: {
      firstName: '',
      lastName: '',
      dob: '',
      idType: '',
      idNumber: '',
      address: '',
      region: '',
      city: '',
      brandName: '',
    },
    business: {
      brandName: '',
      yearEstablished: '',
      website: '',
      social: '',
      legalName: '',
      regNumber: '',
      tin: '',
      address: '',
      region: '',
      city: '',
      taxAck: false,
    },
    operatingRegions: [],
    services: [],
    payout: {
      method: 'bank',
      bank: { accountName: '', accountNumber: '', bankName: '', bankCountry: 'Ghana', currency: 'GHS' },
      paypal: { accountName: '', email: '' },
      momo: { accountName: '', network: '', number: '', currency: 'GHS' },
      schedule: 'weekly',
      primary: true,
    },
    compliance: { acceptAll: false },
    primaryDocument: null,
  }
}

function draftStorageKey(userId?: string | null): string {
  const id = String(userId || '').trim()
  return `${DRAFT_PREFIX}${id || 'anonymous'}`
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

/** Strip File objects — they cannot be stored in the browser. */
function serializeFormForDraft(form: SupplierRegistrationForm): SupplierRegistrationForm {
  return { ...form, primaryDocument: null }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object'
}

function str(value: unknown, fallback = ''): string {
  return typeof value === 'string' ? value : fallback
}

function bool(value: unknown, fallback = false): boolean {
  return typeof value === 'boolean' ? value : fallback
}

function strArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((v): v is string => typeof v === 'string') : []
}

export function mergeSupplierRegistrationDraft(saved?: unknown): SupplierRegistrationForm {
  const empty = createEmptySupplierRegistrationForm()
  if (!isRecord(saved)) return empty

  const account = isRecord(saved.account) ? saved.account : {}
  const individual = isRecord(saved.individual) ? saved.individual : {}
  const business = isRecord(saved.business) ? saved.business : {}
  const payout = isRecord(saved.payout) ? saved.payout : {}
  const bank = isRecord(payout.bank) ? payout.bank : {}
  const paypal = isRecord(payout.paypal) ? payout.paypal : {}
  const momo = isRecord(payout.momo) ? payout.momo : {}
  const compliance = isRecord(saved.compliance) ? saved.compliance : {}

  return {
    account: {
      firstName: str(account.firstName),
      lastName: str(account.lastName),
      email: str(account.email),
      phone: str(account.phone),
    },
    supplierCardId: str(saved.supplierCardId),
    supplierKind: str(saved.supplierKind),
    individual: {
      firstName: str(individual.firstName),
      lastName: str(individual.lastName),
      dob: str(individual.dob),
      idType: str(individual.idType),
      idNumber: str(individual.idNumber),
      address: str(individual.address),
      region: str(individual.region),
      city: str(individual.city),
      brandName: str(individual.brandName),
    },
    business: {
      brandName: str(business.brandName),
      yearEstablished: str(business.yearEstablished),
      website: str(business.website),
      social: str(business.social),
      legalName: str(business.legalName),
      regNumber: str(business.regNumber),
      tin: str(business.tin),
      address: str(business.address),
      region: str(business.region),
      city: str(business.city),
      taxAck: bool(business.taxAck),
    },
    operatingRegions: strArray(saved.operatingRegions),
    services: strArray(saved.services),
    payout: {
      method: str(payout.method, 'bank'),
      bank: {
        accountName: str(bank.accountName),
        accountNumber: str(bank.accountNumber),
        bankName: str(bank.bankName),
        bankCountry: str(bank.bankCountry, 'Ghana'),
        currency: str(bank.currency, 'GHS'),
      },
      paypal: {
        accountName: str(paypal.accountName),
        email: str(paypal.email),
      },
      momo: {
        accountName: str(momo.accountName),
        network: str(momo.network),
        number: str(momo.number),
        currency: str(momo.currency, 'GHS'),
      },
      schedule: str(payout.schedule, 'weekly'),
      primary: bool(payout.primary, true),
    },
    compliance: { acceptAll: bool(compliance.acceptAll) },
    primaryDocument: null,
  }
}

function normalizeDraftPayload(parsed: unknown): StoredDraft | null {
  if (!isRecord(parsed)) return null

  const step = Number(parsed.step)
  const safeStep = Number.isFinite(step) && step >= 0 && step < STEPS_COUNT ? Math.floor(step) : 0
  const updatedAt = Number(parsed.updatedAt) || 0

  return {
    step: safeStep,
    form: mergeSupplierRegistrationDraft(parsed.form),
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

/**
 * @returns The latest draft (step + form) for the user, or null.
 */
export function loadSupplierRegistrationDraft(
  userId?: string | null
): { step: number; form: SupplierRegistrationForm } | null {
  if (typeof window === 'undefined') return null

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
 * Save the in-progress registration so a refresh does not lose input.
 */
export function saveSupplierRegistrationDraft(
  userId: string | null | undefined,
  draft: { step: number; form: SupplierRegistrationForm }
): void {
  if (typeof window === 'undefined') return

  if (userId) rememberDraftUserId(userId)

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
export function clearSupplierRegistrationDraft(userId?: string | null): void {
  if (typeof window === 'undefined') return

  const key = draftStorageKey(userId)
  for (const { get } of STORAGES) {
    try {
      get().removeItem(key)
    } catch {
      // ignore
    }
  }
}
