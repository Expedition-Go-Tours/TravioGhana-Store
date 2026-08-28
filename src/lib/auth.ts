const AUTH_STORAGE_KEY = 'travio_ghana_auth'
const AUTH_RETURN_TO_KEY = 'eg_auth_return_to'

const rawBase = import.meta.env.VITE_AUTH_API_BASE_URL || import.meta.env.VITE_API_URL || '/api'

let API_BASE = rawBase.replace(/\/+$/, '')

if (/^https?:\/\/[^/]+$/.test(API_BASE)) {
  API_BASE = `${API_BASE}/api`
}

// Provider resolution: default to the real backend whenever an API base is
// configured (a silently-absent VITE_AUTH_PROVIDER used to ship "mock" Google
// auth to production, logging everyone in as the hardcoded user@gmail.com).
// Mock is only honored when explicitly requested via VITE_AUTH_PROVIDER=mock.
const AUTH_PROVIDER = import.meta.env.VITE_AUTH_PROVIDER || (API_BASE ? 'backend' : 'mock')
const isBackend = AUTH_PROVIDER === 'backend'
const isMockExplicit = import.meta.env.VITE_AUTH_PROVIDER === 'mock'

if (!isBackend && !isMockExplicit) {
  console.warn(`[Auth] Unknown auth provider "${AUTH_PROVIDER}". Set VITE_AUTH_PROVIDER=backend (or 'mock' for local UI dev only).`)
}
if (isMockExplicit) {
  console.warn('[Auth] Mock auth provider active (VITE_AUTH_PROVIDER=mock). No real accounts — this is for local UI development only and must not ship to production.')
}

interface StoredAuth {
  accessToken: string | null
  refreshToken: string | null
  user: AuthUser | null
}

export interface AuthUser {
  id?: string
  _id?: string
  uid?: string
  firebaseUid?: string
  name?: string
  email?: string
  photoURL?: string
  roles?: string[]
}

type AuthStateListener = (user: AuthUser | null) => void
let authStateListeners: AuthStateListener[] = []

// Migrate old individual keys to single storage key
try {
  const oldUser = localStorage.getItem('user')
  const oldAccess = localStorage.getItem('accessToken')
  const oldRefresh = localStorage.getItem('refreshToken')
  if (oldUser || oldAccess || oldRefresh) {
    if (!localStorage.getItem(AUTH_STORAGE_KEY)) {
      localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify({
        accessToken: oldAccess || null,
        refreshToken: oldRefresh || null,
        user: oldUser ? JSON.parse(oldUser) : null,
      }))
    }
    localStorage.removeItem('user')
    localStorage.removeItem('accessToken')
    localStorage.removeItem('refreshToken')
  }
} catch { /* ignore */ }

// Purge stale mock sessions (e.g. builds that shipped mock Google auth and
// logged everyone in as the hardcoded user@gmail.com) so users aren't left
// "signed in" as a fake account after the provider is fixed.
try {
  const { user } = getStoredAuth()
  const mockUid = getAuthUserId(user)
  if (user && (mockUid?.startsWith('mock-') || (user.email === 'user@gmail.com' && !mockUid))) {
    clearAuth()
  }
} catch { /* ignore */ }

function getStoredAuth(): StoredAuth {
  try {
    const d = localStorage.getItem(AUTH_STORAGE_KEY)
    return d ? JSON.parse(d) : { accessToken: null, refreshToken: null, user: null }
  } catch {
    return { accessToken: null, refreshToken: null, user: null }
  }
}

function storeAuth(data: StoredAuth) {
  try {
    localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(data))
  } catch (e) {
    console.error('Failed to store auth:', e)
  }
}

function clearAuth() {
  try {
    localStorage.removeItem(AUTH_STORAGE_KEY)
  } catch {
    /* ignore */
  }
}

export function setAuthReturnTo(path: string) {
  if (!path) return
  try {
    sessionStorage.setItem(AUTH_RETURN_TO_KEY, path)
  } catch {
    /* ignore */
  }
}

export function getAuthReturnTo(): string | null {
  try {
    return sessionStorage.getItem(AUTH_RETURN_TO_KEY) || null
  } catch {
    return null
  }
}

export function clearAuthReturnTo() {
  try {
    sessionStorage.removeItem(AUTH_RETURN_TO_KEY)
  } catch {
    /* ignore */
  }
}

export function getAuthUserId(user: AuthUser | null): string | null {
  return user?.id || user?._id || user?.uid || user?.firebaseUid || null
}

function notifyAuthStateChange(user: AuthUser | null) {
  authStateListeners.forEach((l) => l(user))
}

export function getAuthProvider(): string {
  return AUTH_PROVIDER
}

export function getApiBaseUrl(): string {
  return API_BASE
}

export function getStoredAuthUser(): AuthUser | null {
  const { user } = getStoredAuth()
  return user
}

export async function getAuthToken(): Promise<string | null> {
  const { accessToken } = getStoredAuth()
  return accessToken || null
}

/** Access + refresh tokens for the current stored session (used to hand a
 *  session over to the Travio Ghana-Supplier platform via SSO). */
export function getStoredAuthTokens(): { accessToken: string | null; refreshToken: string | null } {
  const { accessToken, refreshToken } = getStoredAuth()
  return { accessToken: accessToken || null, refreshToken: refreshToken || null }
}

/**
 * Wait for an authentication token to become available
 * @param maxMs - Maximum time to wait in milliseconds (default: 5000)
 * @returns The authentication token if available, null otherwise
 */
export async function waitForAuthToken(maxMs = 5000): Promise<string | null> {
  const start = Date.now() // Record the start time
  const interval = 250 // Check every 250ms

  // Loop until maxMs has elapsed
  while (Date.now() - start < maxMs) {
    const { accessToken } = getStoredAuth() // Get stored authentication
    if (accessToken) return accessToken // Return token if available
    await new Promise((resolve) => setTimeout(resolve, interval)) // Wait before next check
  }

  // Final check after maxMs has elapsed
  const { accessToken } = getStoredAuth()
  return accessToken || null
}

export async function subscribeToAuthState(callback: AuthStateListener): Promise<() => void> {
  authStateListeners.push(callback)

  const { user } = getStoredAuth()
  callback(user)

  return () => {
    authStateListeners = authStateListeners.filter((l) => l !== callback)
  }
}

async function authFetch(path: string, options: RequestInit = {}) {
  const url = `${API_BASE}${path}`
  const res = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers as Record<string, string>),
    },
  })

  const payload = await res.json().catch(() => ({}))

  if (!res.ok) {
    throw new Error(payload.message || `Request failed with status ${res.status}`)
  }

  return payload
}

export async function signInWithEmail(email: string, password: string): Promise<AuthUser> {
  if (isBackend) {
    const payload = await authFetch('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    })

    const user = payload.data?.user || payload.user || payload
    const accessToken = payload.data?.accessToken || payload.accessToken
    const refreshToken = payload.data?.refreshToken || payload.refreshToken

    storeAuth({ accessToken, refreshToken, user })
    notifyAuthStateChange(user)
    return user
  }

  if (!isMockExplicit) {
    throw new Error('Sign-in is not configured. Set VITE_AUTH_PROVIDER=backend.')
  }

  await new Promise((r) => setTimeout(r, 800))
  const user = {
    id: 'mock-' + Date.now(),
    email,
    name: email.split('@')[0],
  }
  storeAuth({ accessToken: null, refreshToken: null, user })
  notifyAuthStateChange(user)
  return user
}

export async function registerWithEmail(name: string, email: string, password: string): Promise<AuthUser> {
  if (isBackend) {
    const payload = await authFetch('/auth/register', {
      method: 'POST',
      body: JSON.stringify({ name, email, password }),
    })

    const user = payload.data?.user || payload.user || payload
    const accessToken = payload.data?.accessToken || payload.accessToken
    const refreshToken = payload.data?.refreshToken || payload.refreshToken

    storeAuth({ accessToken, refreshToken, user })
    notifyAuthStateChange(user)
    return user
  }

  if (!isMockExplicit) {
    throw new Error('Registration is not configured. Set VITE_AUTH_PROVIDER=backend.')
  }

  await new Promise((r) => setTimeout(r, 1000))
  const user = {
    id: 'mock-' + Date.now(),
    email,
    name,
  }
  storeAuth({ accessToken: null, refreshToken: null, user })
  notifyAuthStateChange(user)
  return user
}

export async function signInWithGoogle(): Promise<{ redirected?: boolean } | AuthUser> {
  if (isBackend) {
    await new Promise((r) => setTimeout(r, 600))
    const origin = window.location.origin
    window.location.href = `${API_BASE}/auth/google?state=${encodeURIComponent(origin)}`
    return { redirected: true }
  }

  if (!isMockExplicit) {
    throw new Error('Google sign-in is not configured. Set VITE_AUTH_PROVIDER=backend and VITE_GOOGLE_CLIENT_ID.')
  }

  await new Promise((r) => setTimeout(r, 1200))
  const user: AuthUser = {
    id: 'mock-google-' + Date.now(),
    email: 'user@gmail.com',
    name: 'Google User',
    photoURL: 'https://via.placeholder.com/150',
  }
  storeAuth({ accessToken: null, refreshToken: null, user })
  notifyAuthStateChange(user)
  return user
}

export async function signInWithGoogleOneTap(credential: string): Promise<AuthUser> {
  if (isBackend) {
    const payload = await authFetch('/auth/google/onetap', {
      method: 'POST',
      body: JSON.stringify({ credential }),
    })

    const user = payload.data?.user || payload.user || payload
    const accessToken = payload.data?.accessToken || payload.accessToken
    const refreshToken = payload.data?.refreshToken || payload.refreshToken

    storeAuth({ accessToken, refreshToken, user })
    notifyAuthStateChange(user)
    return user
  }

  if (!isMockExplicit) {
    throw new Error('Google sign-in is not configured. Set VITE_AUTH_PROVIDER=backend and VITE_GOOGLE_CLIENT_ID.')
  }

  await new Promise((r) => setTimeout(r, 800))
  const user: AuthUser = {
    id: 'mock-google-' + Date.now(),
    email: 'user@gmail.com',
    name: 'Google User',
  }
  storeAuth({ accessToken: null, refreshToken: null, user })
  notifyAuthStateChange(user)
  return user
}

export function getGoogleClientId(): string {
  return import.meta.env.VITE_GOOGLE_CLIENT_ID || ''
}

export function googleOneTapSupported(): boolean {
  return isBackend && Boolean(getGoogleClientId())
}

export async function signOutUser() {
  if (isBackend) {
    try {
      const token = await getAuthToken()
      if (token) {
        const { refreshToken } = getStoredAuth()
        await fetch(`${API_BASE}/auth/logout`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ refreshToken }),
        })
      }
    } catch {
      /* ignore network errors on logout */
    }
  }

  clearAuth()
  notifyAuthStateChange(null)
}

let refreshPromise: Promise<string | null> | null = null

export async function refreshAuthToken(): Promise<string | null> {
  if (refreshPromise) return refreshPromise

  refreshPromise = (async () => {
    const { refreshToken } = getStoredAuth()
    if (!refreshToken) {
      clearAuth()
      notifyAuthStateChange(null)
      throw new Error('No refresh token available')
    }

    try {
      const payload = await authFetch('/auth/refresh', {
        method: 'POST',
        body: JSON.stringify({ refreshToken }),
      })

      const newAccessToken = payload.data?.accessToken || payload.accessToken
      const newRefreshToken = payload.data?.refreshToken || payload.refreshToken
      const auth = getStoredAuth()

      storeAuth({ accessToken: newAccessToken, refreshToken: newRefreshToken, user: auth.user })

      return newAccessToken
    } catch (error) {
      clearAuth()
      notifyAuthStateChange(null)
      throw error
    }
  })()

  refreshPromise.finally(() => { refreshPromise = null })
  return refreshPromise
}

export async function fetchCurrentUser(token: string): Promise<AuthUser> {
  const res = await fetch(`${API_BASE}/users/me`, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/json',
    },
  })

  if (!res.ok) {
    throw new Error('Failed to fetch user profile')
  }

  const payload = await res.json()
  return payload.data?.user || payload.user || payload
}

export async function refreshStoredUserFromBackend(): Promise<AuthUser | null> {
  try {
    const token = await getAuthToken()
    if (!token) return null

    const payload = await authFetch('/users/me', {
      headers: { Authorization: `Bearer ${token}` },
    })

    const user = payload?.data?.user ?? payload?.data ?? null
    if (user) {
      const auth = getStoredAuth()
      storeAuth({ ...auth, user })
      notifyAuthStateChange(user)
      return user
    }
  } catch {
    return null
  }

  return null
}

function decodeJwtPayload(token: string): Record<string, unknown> | null {
  try {
    const parts = token.split('.')
    if (parts.length !== 3) return null
    const payload = parts[1]
    const decoded = atob(payload.replace(/-/g, '+').replace(/_/g, '/'))
    return JSON.parse(decodeURIComponent(decoded.split('').map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2)).join('')))
  } catch {
    return null
  }
}

export async function handleGoogleCallback(): Promise<boolean> {
  const params = new URLSearchParams(window.location.search)
  const accessToken = params.get('accessToken')
  const refreshToken = params.get('refreshToken')
  if (!accessToken || !refreshToken) return false

  const auth = getStoredAuth()
  storeAuth({ ...auth, accessToken, refreshToken })

  try {
    const user = await fetchCurrentUser(accessToken)
    storeAuth({ accessToken, refreshToken, user })
    notifyAuthStateChange(user)
  } catch {
    const payload = decodeJwtPayload(accessToken)
    const userId = payload?.userId || payload?.id || payload?.sub
    const fallbackUser: AuthUser = userId
      ? { id: String(userId), email: payload?.email ? String(payload.email) : undefined, name: payload?.name ? String(payload.name) : undefined }
      : {}
    storeAuth({ accessToken, refreshToken, user: fallbackUser })
    notifyAuthStateChange(fallbackUser)
  }

  window.history.replaceState({}, '', window.location.origin + window.location.pathname)
  return true
}
