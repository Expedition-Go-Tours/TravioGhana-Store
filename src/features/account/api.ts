import { getApiBaseUrl, getAuthToken } from '../../lib/auth'

const API_BASE = getApiBaseUrl()

async function apiFetch<T = unknown>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const token = await getAuthToken()
  if (!token) throw new Error('Not authenticated')

  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      ...(options.body instanceof FormData
        ? {}
        : { 'Content-Type': 'application/json' }),
      Authorization: `Bearer ${token}`,
      ...(options.headers as Record<string, string>),
    },
  })

  const payload = await res.json().catch(() => ({}))
  if (!res.ok) {
    throw new Error(payload.message || `Request failed (${res.status})`)
  }
  return payload as T
}

// ── Profile ─────────────────────────────────────────────────────────────

export interface AccountProfile {
  id: string
  name?: string
  email?: string
  phone?: string
  photoURL?: string
  logoUrl?: string
  language?: string
  timezone?: string
  dateOfBirth?: string | null
  address?: string | null
  city?: string | null
  state?: string | null
  zipCode?: string | null
  country?: string | null
  homeAirport?: string | null
  roles?: string[]
  active?: boolean
  emailVerified?: boolean
  notificationPreferences?: Record<string, unknown> | null
}

export async function getAccount(): Promise<AccountProfile> {
  const res = await apiFetch<{ data: { user: AccountProfile } }>('/users/me')
  return res.data.user
}

export async function updateAccount(
  data: Record<string, unknown>,
  avatarFile?: File | null,
): Promise<AccountProfile> {
  if (avatarFile) {
    const fd = new FormData()
    for (const [k, v] of Object.entries(data)) {
      if (v !== undefined && v !== null) fd.append(k, String(v))
    }
    fd.append('photo', avatarFile)
    const res = await apiFetch<{ data: { user: AccountProfile } }>(
      '/users/updateMe',
      { method: 'PATCH', body: fd as unknown as FormData },
    )
    return res.data.user
  }

  const res = await apiFetch<{ data: { user: AccountProfile } }>(
    '/users/updateMe',
    { method: 'PATCH', body: JSON.stringify(data) },
  )
  return res.data.user
}

// ── Password ────────────────────────────────────────────────────────────

export async function changePassword(
  currentPassword: string,
  newPassword: string,
): Promise<void> {
  await apiFetch('/auth/change-password', {
    method: 'PATCH',
    body: JSON.stringify({ currentPassword, newPassword }),
  })
}

// ── Saved cards (Stripe payment methods) ────────────────────────────────

export interface SavedCard {
  id: string
  brand: string
  last4: string
  expMonth: number | null
  expYear: number | null
  expired: boolean
  isDefault: boolean
}

export async function getPaymentMethods(): Promise<SavedCard[]> {
  const res = await apiFetch<{ data: { cards: SavedCard[] } }>(
    '/users/payment-methods',
  )
  return res.data.cards
}

export async function createSetupIntent(): Promise<string> {
  const res = await apiFetch<{ data: { clientSecret: string } }>(
    '/users/payment-methods/setup-intent',
    { method: 'POST' },
  )
  return res.data.clientSecret
}

export async function setDefaultPaymentMethod(id: string): Promise<void> {
  await apiFetch(`/users/payment-methods/${id}/default`, { method: 'PATCH' })
}

export async function detachPaymentMethod(id: string): Promise<void> {
  await apiFetch(`/users/payment-methods/${id}`, { method: 'DELETE' })
}
