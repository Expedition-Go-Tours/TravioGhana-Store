import { getAuthToken, getApiBaseUrl, refreshAuthToken } from './auth'

export class ApiError extends Error {
  status: number
  constructor(message: string, status: number) {
    super(message)
    this.name = 'ApiError'
    this.status = status
  }
}

/**
 * fetch() with the auth token attached, plus automatic session recovery:
 * if the request returns 401 while we sent a Bearer token, it refreshes the
 * access token once and retries before surfacing the error.
 *
 * Backend access tokens expire after 1h (config/jwt.js). Without this,
 * any long-lived tab silently fails on every authenticated request once
 * the token lapses — the original wishlist bug ("Invalid or expired token").
 *
 * Returns the raw Response so callers keep their own JSON parsing.
 */
export async function fetchWithAuth(path: string, options: RequestInit = {}): Promise<Response> {
  const base = getApiBaseUrl()
  const token = await getAuthToken()

  const isFormData = options.body instanceof FormData

  const doFetch = (t: string | null) =>
    fetch(`${base}${path}`, {
      ...options,
      headers: {
        // Skip the JSON content type for multipart bodies — the browser sets
        // the boundary automatically when Content-Type is left unset.
        ...(isFormData ? {} : { 'Content-Type': 'application/json' }),
        Accept: 'application/json',
        ...(t ? { Authorization: `Bearer ${t}` } : {}),
        ...(options.headers as Record<string, string>),
      },
    })

  let res = await doFetch(token)

  if (res.status === 401 && token) {
    try {
      const newToken = await refreshAuthToken()
      if (newToken) res = await doFetch(newToken)
    } catch {
      // Refresh failed (or no refresh token) → the session is gone; fall
      // through so callers observe the original 401.
    }
  }

  return res
}

export async function apiFetch<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetchWithAuth(path, options)

  const payload = await res.json().catch(() => ({}))
  if (!res.ok) {
    throw new ApiError(payload.message || `Request failed (${res.status})`, res.status)
  }

  return payload.data ?? payload
}
