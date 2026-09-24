import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const AUTH_STORAGE_KEY = 'expedition_go_auth'

/**
 * auth.ts resolves its provider/API base at import time, so each test stubs the
 * env and then imports a fresh module instance. Fetch is always stubbed so no
 * request can leave the test.
 */
async function loadAuth() {
  vi.resetModules()
  vi.stubEnv('VITE_AUTH_PROVIDER', 'backend')
  vi.stubEnv('VITE_AUTH_API_BASE_URL', 'https://api.test/api')
  return import('../auth')
}

function jsonResponse(body: unknown) {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  })
}

function loginResponse() {
  return jsonResponse({
    data: {
      user: { id: 'u1', email: 'ada@example.com', name: 'Ada' },
      accessToken: 'at-1',
      refreshToken: 'rt-1',
    },
  })
}

beforeEach(() => {
  window.localStorage.clear()
  window.sessionStorage.clear()
})

afterEach(() => {
  vi.unstubAllEnvs()
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('remember-me session storage', () => {
  it('stores a remembered sign-in in localStorage only', async () => {
    const auth = await loadAuth()
    vi.stubGlobal('fetch', vi.fn(async () => loginResponse()))

    await auth.signInWithEmail('ada@example.com', 'password123', { remember: true })

    expect(window.localStorage.getItem(AUTH_STORAGE_KEY)).toContain('at-1')
    expect(window.sessionStorage.getItem(AUTH_STORAGE_KEY)).toBeNull()
    expect(auth.getStoredAuthUser()?.email).toBe('ada@example.com')
  })

  it('stores a session-only sign-in in sessionStorage only', async () => {
    const auth = await loadAuth()
    vi.stubGlobal('fetch', vi.fn(async () => loginResponse()))

    await auth.signInWithEmail('ada@example.com', 'password123', { remember: false })

    expect(window.sessionStorage.getItem(AUTH_STORAGE_KEY)).toContain('at-1')
    expect(window.localStorage.getItem(AUTH_STORAGE_KEY)).toBeNull()
    expect(auth.getStoredAuthTokens()).toEqual({ accessToken: 'at-1', refreshToken: 'rt-1' })
  })

  it('defaults to remembered when no choice is given', async () => {
    const auth = await loadAuth()
    vi.stubGlobal('fetch', vi.fn(async () => loginResponse()))

    await auth.signInWithEmail('ada@example.com', 'password123')

    expect(window.localStorage.getItem(AUTH_STORAGE_KEY)).not.toBeNull()
    expect(window.sessionStorage.getItem(AUTH_STORAGE_KEY)).toBeNull()
  })

  it('keeps a session-only session session-only across a token refresh', async () => {
    const auth = await loadAuth()
    vi.stubGlobal('fetch', vi.fn(async () => loginResponse()))
    await auth.signInWithEmail('ada@example.com', 'password123', { remember: false })

    vi.stubGlobal('fetch', vi.fn(async () => jsonResponse({
      data: { accessToken: 'at-2', refreshToken: 'rt-2' },
    })))
    await auth.refreshAuthToken()

    expect(window.sessionStorage.getItem(AUTH_STORAGE_KEY)).toContain('at-2')
    expect(window.localStorage.getItem(AUTH_STORAGE_KEY)).toBeNull()
  })

  it('signing in again without remember clears the remembered copy', async () => {
    const auth = await loadAuth()
    vi.stubGlobal('fetch', vi.fn(async () => loginResponse()))
    await auth.signInWithEmail('ada@example.com', 'password123', { remember: true })

    vi.stubGlobal('fetch', vi.fn(async () => loginResponse()))
    await auth.signInWithEmail('ada@example.com', 'password123', { remember: false })

    expect(window.localStorage.getItem(AUTH_STORAGE_KEY)).toBeNull()
    expect(window.sessionStorage.getItem(AUTH_STORAGE_KEY)).not.toBeNull()
  })

  it('sign-out clears both areas', async () => {
    const auth = await loadAuth()
    vi.stubGlobal('fetch', vi.fn(async () => loginResponse()))
    await auth.signInWithEmail('ada@example.com', 'password123', { remember: false })

    vi.stubGlobal('fetch', vi.fn(async () => jsonResponse({})))
    await auth.signOutUser()

    expect(window.localStorage.getItem(AUTH_STORAGE_KEY)).toBeNull()
    expect(window.sessionStorage.getItem(AUTH_STORAGE_KEY)).toBeNull()
    expect(auth.getStoredAuthUser()).toBeNull()
  })

  it('honors the remember choice recorded before the Google redirect', async () => {
    const auth = await loadAuth()
    auth.setPendingRemember(false)

    window.history.replaceState({}, '', '/?accessToken=at-google&refreshToken=rt-google')
    vi.stubGlobal('fetch', vi.fn(async () => jsonResponse({ data: { user: { id: 'u1', email: 'ada@example.com' } } })))

    await auth.handleGoogleCallback()

    expect(window.sessionStorage.getItem(AUTH_STORAGE_KEY)).toContain('at-google')
    expect(window.localStorage.getItem(AUTH_STORAGE_KEY)).toBeNull()
    window.history.replaceState({}, '', '/')
  })

  it('keeps Google callbacks remembered by default', async () => {
    const auth = await loadAuth()

    window.history.replaceState({}, '', '/?accessToken=at-google&refreshToken=rt-google')
    vi.stubGlobal('fetch', vi.fn(async () => jsonResponse({ data: { user: { id: 'u1', email: 'ada@example.com' } } })))

    await auth.handleGoogleCallback()

    expect(window.localStorage.getItem(AUTH_STORAGE_KEY)).toContain('at-google')
    expect(window.sessionStorage.getItem(AUTH_STORAGE_KEY)).toBeNull()
    window.history.replaceState({}, '', '/')
  })
})
