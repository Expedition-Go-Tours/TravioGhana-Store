import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { clearSerpApiMapsCache, searchGhanaLocations } from '../serpApiMapsSearch'

const fetchMock = vi.fn()

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

beforeEach(() => {
  clearSerpApiMapsCache()
  fetchMock.mockReset()
  vi.stubGlobal('fetch', fetchMock)
})

afterEach(() => {
  vi.unstubAllGlobals()
})

const place = {
  title: 'Kaneshie Market',
  address: 'Kaneshie, Accra, Ghana',
  lat: 5.5735,
  lng: -0.2456,
  placeId: 'ChIJkaneshie',
}

describe('searchGhanaLocations', () => {
  it('calls the same-origin route with the query and area and returns places', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ ok: true, results: [place] }))

    const outcome = await searchGhanaLocations('Kaneshie Market', { lat: 5.57, lng: -0.24 })

    expect(fetchMock).toHaveBeenCalledTimes(1)
    const url = fetchMock.mock.calls[0][0] as string
    expect(url.startsWith('/api/maps-search?')).toBe(true)
    expect(url).toContain('q=Kaneshie+Market')
    expect(url).toContain('lat=5.57')
    expect(url).toContain('lng=-0.24')
    expect(outcome).toEqual({ status: 'ok', results: [place] })
  })

  it('caches results per query + area (case-insensitive, no repeated credits)', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ ok: true, results: [place] }))

    await searchGhanaLocations('Osu', { lat: 5.55, lng: -0.19 })
    await searchGhanaLocations('osu', { lat: 5.55, lng: -0.19 })
    await searchGhanaLocations('Osu', { lat: 6.6, lng: -1.6 })

    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it('maps failure reasons from the server route', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ ok: false, reason: 'quota' }))
    expect((await searchGhanaLocations('Kaneshie', null)).status).toBe('quota')

    fetchMock.mockResolvedValueOnce(jsonResponse({ ok: false, reason: 'not_configured' }))
    expect((await searchGhanaLocations('Kaneshie', null)).status).toBe('not_configured')

    fetchMock.mockResolvedValueOnce(jsonResponse({ ok: false, reason: 'upstream' }))
    expect((await searchGhanaLocations('Kaneshie', null)).status).toBe('unavailable')
  })

  it('returns unavailable on network failures and non-JSON responses', async () => {
    fetchMock.mockRejectedValueOnce(new Error('network down'))
    expect((await searchGhanaLocations('Kaneshie', null)).status).toBe('unavailable')

    // e.g. plain `vite dev` without the dev route — the SPA shell comes back.
    fetchMock.mockResolvedValueOnce(
      new Response('<!doctype html>', { status: 200, headers: { 'Content-Type': 'text/html' } }),
    )
    expect((await searchGhanaLocations('Kaneshie', null)).status).toBe('unavailable')
  })

  it('does not fetch for short queries', async () => {
    expect(await searchGhanaLocations('ab', null)).toEqual({ status: 'empty', results: [] })
    expect(fetchMock).not.toHaveBeenCalled()
  })
})
