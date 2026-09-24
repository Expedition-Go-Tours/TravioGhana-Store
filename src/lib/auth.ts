const AUTH_STORAGE_KEY = 'expedition_go_auth'
const AUTH_RETURN_TO_KEY = 'eg_auth_return_to'
/** Remember-me choice for flows that leave the page (Google OAuth redirect). */
const AUTH_PENDING_REMEMBER_KEY = 'eg_auth_pending_remember'

/**
 * Where the session lives:
 *  - 'local'   → localStorage, survives browser restarts ("Remember me" on)
 *  - 'session' → sessionStorage, cleared when the tab/browser closes
 */
type AuthStorageArea = 'local' | 'session'

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

function areaStorage(area: AuthStorageArea): Storage | null {
  if (typeof window === 'undefined') return null
  try {
    return area === 'session' ? window.sessionStorage : window.localStorage
  } catch {
    return null
  }
}

/**
 * Read the stored session together with the area it lives in, so every later
 * write (token refresh, profile patch) lands back in the same place — a
 * session-only sign-in must never silently become persistent.
 */
function readStoredAuthState(): { auth: StoredAuth; area: AuthStorageArea | null } {
  for (const area of ['local', 'session'] as const) {
    try {
      const raw = areaStorage(area)?.getItem(AUTH_STORAGE_KEY)
      if (raw) return { auth: JSON.parse(raw) as StoredAuth, area }
    } catch {
      /* unreadable copy — try the next area */
    }
  }
  return { auth: { accessToken: null, refreshToken: null, user: null }, area: null }
}

function getStoredAuth(): StoredAuth {
  return readStoredAuthState().auth
}

function storeAuth(data: StoredAuth, area: AuthStorageArea = 'local') {
  try {
    areaStorage(area)?.setItem(AUTH_STORAGE_KEY, JSON.stringify(data))
    // Never leave a stale copy behind in the other area.
    areaStorage(area === 'local' ? 'session' : 'local')?.removeItem(AUTH_STORAGE_KEY)
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
  try {
    sessionStorage.removeItem(AUTH_STORAGE_KEY)
  } catch {
    /* ignore */
  }
}

/** Map a remember-me choice to its storage area (default: remembered). */
function rememberArea(remember?: boolean): AuthStorageArea {
  return remember === false ? 'session' : 'local'
}

/** Record the remember-me choice for flows that leave the page (Google OAuth). */
export function setPendingRemember(remember: boolean): void {
  try {
    sessionStorage.setItem(AUTH_PENDING_REMEMBER_KEY, remember ? '1' : '0')
  } catch {
    /* ignore */
  }
}

/** Consume the pending remember-me choice; defaults to remembered. */
export function consumePendingRemember(): boolean {
  try {
    const raw = sessionStorage.getItem(AUTH_PENDING_REMEMBER_KEY)
    sessionStorage.removeItem(AUTH_PENDING_REMEMBER_KEY)
    return raw !== '0'
  } catch {
    return true
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

/** Merge a partial update into the locally stored user and notify listeners. */
export function updateStoredAuthUser(patch: Partial<AuthUser>): void {
  const { auth, area } = readStoredAuthState()
  if (!auth.user) return
  const updated = { ...auth.user, ...patch }
  storeAuth({ ...auth, user: updated }, area ?? 'local')
  notifyAuthStateChange(updated)
}

export async function getAuthToken(): Promise<string | null> {
  const { accessToken } = getStoredAuth()
  return accessToken || null
}

/** Access + refresh tokens for the current stored session (used to hand a
 *  session over to the TravioAfrica-Supplier platform via SSO). */
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

export async function signInWithEmail(
  email: string,
  password: string,
  options: { remember?: boolean } = {},
): Promise<AuthUser> {
  const area = rememberArea(options.remember)
  if (isBackend) {
    const payload = await authFetch('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    })

    const user = payload.data?.user || payload.user || payload
    const accessToken = payload.data?.accessToken || payload.accessToken
    const refreshToken = payload.data?.refreshToken || payload.refreshToken

    storeAuth({ accessToken, refreshToken, user }, area)
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
  storeAuth({ accessToken: null, refreshToken: null, user }, area)
  notifyAuthStateChange(user)
  return user
}

export async function registerWithEmail(
  name: string,
  email: string,
  password: string,
  options: { remember?: boolean } = {},
): Promise<AuthUser> {
  const area = rememberArea(options.remember)
  if (isBackend) {
    const payload = await authFetch('/auth/register', {
      method: 'POST',
      body: JSON.stringify({ name, email, password }),
    })

    const user = payload.data?.user || payload.user || payload
    const accessToken = payload.data?.accessToken || payload.accessToken
    const refreshToken = payload.data?.refreshToken || payload.refreshToken

    storeAuth({ accessToken, refreshToken, user }, area)
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
  storeAuth({ accessToken: null, refreshToken: null, user }, area)
  notifyAuthStateChange(user)
  return user
}

export async function signInWithGoogle(options: { remember?: boolean } = {}): Promise<{ redirected?: boolean } | AuthUser> {
  const remember = options.remember !== false
  // Persist the choice for the redirect round-trip (the page unloads before
  // handleGoogleCallback stores the session).
  setPendingRemember(remember)

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
  storeAuth({ accessToken: null, refreshToken: null, user }, rememberArea(remember))
  notifyAuthStateChange(user)
  return user
}

export async function signInWithGoogleOneTap(
  credential: string,
  options: { remember?: boolean } = {},
): Promise<AuthUser> {
  const area = rememberArea(options.remember)
  if (isBackend) {
    const payload = await authFetch('/auth/google/onetap', {
      method: 'POST',
      body: JSON.stringify({ credential }),
    })

    const user = payload.data?.user || payload.user || payload
    const accessToken = payload.data?.accessToken || payload.accessToken
    const refreshToken = payload.data?.refreshToken || payload.refreshToken

    storeAuth({ accessToken, refreshToken, user }, area)
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
  storeAuth({ accessToken: null, refreshToken: null, user }, area)
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
    const { auth: storedAuth, area } = readStoredAuthState()
    const { refreshToken } = storedAuth
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
      // Preserve the session's own area: a session-only sign-in must stay
      // session-only after a token refresh.
      storeAuth({ accessToken: newAccessToken, refreshToken: newRefreshToken, user: storedAuth.user }, area ?? 'local')

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
      const { auth, area } = readStoredAuthState()
      storeAuth({ ...auth, user }, area ?? 'local')
      notifyAuthStateChange(user)
      return user
    }
  } catch {
    return null
  }

  return null
}

export function decodeJwtPayload(token: string): Record<string, unknown> | null {
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

/** Decode the current access token to extract exp (epoch seconds) and userId. */
export function decodeAccessToken(): { exp: number; userId: string } | null {
  const { accessToken } = getStoredAuth()
  if (!accessToken) return null
  const payload = decodeJwtPayload(accessToken)
  if (!payload) return null
  return {
    exp: typeof payload.exp === 'number' ? payload.exp : 0,
    userId: String(payload.userId || payload.sub || ''),
  }
}

/** Access token expiry as epoch milliseconds, or null if no session. */
export function getAccessTokenExpiryMs(): number | null {
  const decoded = decodeAccessToken()
  if (!decoded || !decoded.exp) return null
  return decoded.exp * 1000
}

/** True if a stored access token exists and has not yet expired. */
export function isSessionValid(): boolean {
  const { accessToken } = getStoredAuth()
  if (!accessToken) return false
  const decoded = decodeAccessToken()
  if (!decoded) return false
  return decoded.exp * 1000 > Date.now()
}

export async function handleGoogleCallback(): Promise<boolean> {
  const params = new URLSearchParams(window.location.search)
  const accessToken = params.get('accessToken')
  const refreshToken = params.get('refreshToken')
  if (!accessToken || !refreshToken) return false

  // Honor the remember-me choice made before the redirect (default: remembered).
  const area = rememberArea(consumePendingRemember())

  const auth = getStoredAuth()
  storeAuth({ ...auth, accessToken, refreshToken }, area)

  try {
    const user = await fetchCurrentUser(accessToken)
    storeAuth({ accessToken, refreshToken, user }, area)
    notifyAuthStateChange(user)
  } catch {
    const payload = decodeJwtPayload(accessToken)
    const userId = payload?.userId || payload?.id || payload?.sub
    const fallbackUser: AuthUser = userId
      ? { id: String(userId), email: payload?.email ? String(payload.email) : undefined, name: payload?.name ? String(payload.name) : undefined }
      : {}
    storeAuth({ accessToken, refreshToken, user: fallbackUser }, area)
    notifyAuthStateChange(fallbackUser)
  }

  window.history.replaceState({}, '', window.location.origin + window.location.pathname)
  return true
}
