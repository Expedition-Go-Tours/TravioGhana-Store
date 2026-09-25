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
  // Only declare a JSON content type when there is a body. Bodyless GETs with
  // Content-Type: application/json are not CORS-simple, so every API call paid
  // an extra OPTIONS preflight round trip; without it (and without a Bearer
  // token) reads are simple requests. Multipart bodies stay unset so the
  // browser can set the boundary itself.
  const hasBody = options.body != null

  const doFetch = (t: string | null) =>
    fetch(`${base}${path}`, {
      ...options,
      headers: {
        ...(hasBody && !isFormData ? { 'Content-Type': 'application/json' } : {}),
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

/**
 * Multipart POST that reports request-body progress.
 *
 * `fetch()` cannot surface upload progress (there are no upload events without
 * request streams + duplex), so document submissions use XMLHttpRequest — the
 * only browser API that exposes `xhr.upload.onprogress`. Auth handling mirrors
 * `fetchWithAuth`: send the token, and on a 401 refresh once and retry (a
 * `FormData` body is reusable, so the retry re-sends the same files).
 *
 * `onProgress` receives whole percentages, and 100 once the browser has handed
 * the last byte to the network — the server still has to store the files, so
 * callers should switch to a "processing" state at 100.
 */
export function apiUploadWithProgress<T>(
  path: string,
  body: FormData,
  onProgress?: (percent: number) => void
): Promise<T> {
  type UploadResult = { status: number; payload: Record<string, unknown> }

  const send = (token: string | null) =>
    new Promise<UploadResult>((resolve, reject) => {
      const xhr = new XMLHttpRequest()
      xhr.open('POST', `${getApiBaseUrl()}${path}`)
      xhr.responseType = 'json'
      xhr.setRequestHeader('Accept', 'application/json')
      if (token) xhr.setRequestHeader('Authorization', `Bearer ${token}`)

      if (onProgress) {
        xhr.upload.onprogress = (event) => {
          if (event.lengthComputable && event.total > 0) {
            onProgress(Math.min(100, Math.round((event.loaded / event.total) * 100)))
          }
        }
        xhr.upload.onload = () => onProgress(100)
      }

      xhr.onload = () =>
        resolve({ status: xhr.status, payload: (xhr.response ?? {}) as Record<string, unknown> })
      xhr.onerror = () =>
        reject(
          new Error(
            'We could not reach TravioGhana to upload your document. Check your connection and try again.'
          )
        )
      xhr.ontimeout = () =>
        reject(new Error('The upload took too long. Check your connection and try again.'))
      xhr.onabort = () => reject(new Error('The upload was cancelled.'))

      xhr.send(body)
    })

  return (async () => {
    const token = await getAuthToken()
    let result = await send(token)

    if (result.status === 401 && token) {
      const refreshed = await refreshAuthToken().catch(() => null)
      if (refreshed) result = await send(refreshed)
    }

    if (result.status < 200 || result.status >= 300) {
      const message =
        typeof result.payload.message === 'string'
          ? result.payload.message
          : `Request failed (${result.status})`
      throw new ApiError(message, result.status)
    }

    return (result.payload.data ?? result.payload) as T
  })()
}

export async function apiFetch<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetchWithAuth(path, options)

  const payload = await res.json().catch(() => ({}))
  if (!res.ok) {
    throw new ApiError(payload.message || `Request failed (${res.status})`, res.status)
  }

  return payload.data ?? payload
}
