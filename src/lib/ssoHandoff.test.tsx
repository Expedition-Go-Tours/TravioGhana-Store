import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

const mocks = vi.hoisted(() => ({
  adoptSession: vi.fn(),
  fetchCurrentUser: vi.fn(),
}))

vi.mock('./auth', () => ({
  adoptSession: mocks.adoptSession,
  fetchCurrentUser: mocks.fetchCurrentUser,
  getApiBaseUrl: () => 'https://api.example.test/api',
  getStoredAuthTokens: () => ({ accessToken: null, refreshToken: null }),
}))

import { consumeHandoff } from './ssoHandoff'

const ADOPTED = {
  accessToken: 'new-access',
  refreshToken: 'new-refresh',
  user: { id: 'user-1', name: 'Ama', email: 'ama@example.com', roles: ['customer'] },
}

const fetchMock = vi.fn()

function setFragment(hash: string) {
  window.history.replaceState(null, '', `${window.location.pathname}${window.location.search}${hash}`)
}

describe('consumeHandoff', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', fetchMock)
    fetchMock.mockReset()
    mocks.adoptSession.mockReset()
    mocks.fetchCurrentUser.mockReset()
    setFragment('')
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    setFragment('')
  })

  it('does nothing on an ordinary arrival', async () => {
    await expect(consumeHandoff()).resolves.toBe(false)
    expect(fetchMock).not.toHaveBeenCalled()
    expect(mocks.adoptSession).not.toHaveBeenCalled()
  })

  it('exchanges the ticket for a session at its own origin', async () => {
    setFragment('#sso=ticket-abc')
    fetchMock.mockResolvedValue({ ok: true, json: async () => ({ data: ADOPTED }) })

    await expect(consumeHandoff()).resolves.toBe(true)

    expect(fetchMock).toHaveBeenCalledTimes(1)
    const [url, options] = fetchMock.mock.calls[0]
    expect(url).toBe('https://api.example.test/api/sso/exchange')
    expect(JSON.parse(options.body)).toEqual({
      ticket: 'ticket-abc',
      destination: window.location.origin,
    })
    expect(options.headers['Content-Type']).toBe('application/json')
    // The exchange is necessarily unauthenticated — the caller has no session yet.
    expect(options.headers.Authorization).toBeUndefined()

    expect(mocks.adoptSession).toHaveBeenCalledWith({
      accessToken: 'new-access',
      refreshToken: 'new-refresh',
      user: ADOPTED.user,
    })
  })

  it('clears the fragment before the network call', async () => {
    setFragment('#sso=ticket-abc')
    let hashDuringRequest: string | null = null
    fetchMock.mockImplementation(async () => {
      // The ticket must already be out of the address bar by the time any
      // request is in flight — it is a credential for 120 seconds.
      hashDuringRequest = window.location.hash
      return { ok: true, json: async () => ({ data: ADOPTED }) }
    })

    await consumeHandoff()

    expect(hashDuringRequest).toBe('')
    expect(window.location.hash).toBe('')
    expect(window.location.pathname).not.toContain('sso=')
  })

  it('returns the user from the exchange without a second lookup', async () => {
    setFragment('#sso=ticket-abc')
    fetchMock.mockResolvedValue({ ok: true, json: async () => ({ data: ADOPTED }) })

    await consumeHandoff()

    expect(mocks.fetchCurrentUser).not.toHaveBeenCalled()
  })

  it('resolves the user once when the exchange omits it', async () => {
    setFragment('#sso=ticket-abc')
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({ data: { accessToken: 'a', refreshToken: 'r', user: null } }),
    })
    mocks.fetchCurrentUser.mockResolvedValue({ id: 'user-1', name: 'Ama' })

    await expect(consumeHandoff()).resolves.toBe(true)
    expect(mocks.fetchCurrentUser).toHaveBeenCalledWith('a')
    expect(mocks.adoptSession).toHaveBeenCalledWith({
      accessToken: 'a',
      refreshToken: 'r',
      user: { id: 'user-1', name: 'Ama' },
    })
  })

  it('does not adopt a session when the exchange is rejected', async () => {
    setFragment('#sso=ticket-abc')
    fetchMock.mockResolvedValue({ ok: false, json: async () => ({ message: 'replayed' }) })

    await expect(consumeHandoff()).resolves.toBe(false)
    expect(mocks.adoptSession).not.toHaveBeenCalled()
  })

  it('does not adopt a session when the network fails', async () => {
    setFragment('#sso=ticket-abc')
    fetchMock.mockRejectedValue(new Error('offline'))

    await expect(consumeHandoff()).resolves.toBe(false)
    expect(mocks.adoptSession).not.toHaveBeenCalled()
  })

  it('refuses a response with no token pair rather than storing a half session', async () => {
    setFragment('#sso=ticket-abc')
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({ data: { user: { id: 'user-1' } } }),
    })

    await expect(consumeHandoff()).resolves.toBe(false)
    expect(mocks.adoptSession).not.toHaveBeenCalled()
  })

  it('tolerates an unescapable ticket without calling the API', async () => {
    setFragment('#sso=%E0%A4%A') // malformed percent-escape

    await expect(consumeHandoff()).resolves.toBe(false)
    expect(fetchMock).not.toHaveBeenCalled()
    expect(mocks.adoptSession).not.toHaveBeenCalled()
  })
})
