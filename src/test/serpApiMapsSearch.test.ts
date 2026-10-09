import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import middleware, {
  DEFAULT_GHANA_ORIGIN,
  handleMapsSearch,
  normalizeResults,
  searchGhanaPlaces,
  SERPAPI_SEARCH_ENDPOINT,
} from '../../middleware'

const fetchMock = vi.fn()

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

beforeEach(() => {
  fetchMock.mockReset()
  vi.stubGlobal('fetch', fetchMock)
  process.env.VITE_SERP_API_KEY = 'test-key'
  delete process.env.SERPAPI_API_KEY
})

afterEach(() => {
  vi.unstubAllGlobals()
  delete process.env.VITE_SERP_API_KEY
  delete process.env.SERPAPI_API_KEY
})

describe('searchGhanaPlaces', () => {
  it('builds the Ghana-localized SerpApi request with the area bias', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ local_results: [] }))

    await searchGhanaPlaces('Kaneshie Market', { lat: 5.57, lng: -0.24 }, 'test-key')

    const url = new URL(fetchMock.mock.calls[0][0] as string)
    expect(`${url.origin}${url.pathname}`).toBe(SERPAPI_SEARCH_ENDPOINT)
    expect(url.searchParams.get('engine')).toBe('google_maps')
    expect(url.searchParams.get('q')).toBe('Kaneshie Market')
    expect(url.searchParams.get('ll')).toBe('@5.57,-0.24,12z')
    expect(url.searchParams.get('google_domain')).toBe('google.com.gh')
    expect(url.searchParams.get('hl')).toBe('en')
    expect(url.searchParams.get('gl')).toBe('gh')
    expect(url.searchParams.get('api_key')).toBe('test-key')
  })

  it('falls back to the Accra origin when the tour has no coordinates', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ local_results: [] }))

    await searchGhanaPlaces('Kaneshie Market', null, 'test-key')

    const url = new URL(fetchMock.mock.calls[0][0] as string)
    expect(url.searchParams.get('ll')).toBe(`@${DEFAULT_GHANA_ORIGIN.lat},${DEFAULT_GHANA_ORIGIN.lng},12z`)
  })

  it('normalizes results and drops entries without coordinates', async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse({
        local_results: [
          {
            title: 'Kaneshie Market',
            address: 'Kaneshie, Accra, Ghana',
            country: 'Ghana',
            gps_coordinates: { latitude: 5.5735, longitude: -0.2456 },
            place_id: 'ChIJkaneshie',
          },
          { title: 'No coords', address: 'Somewhere', gps_coordinates: {} },
          { address: 'Address only', gps_coordinates: { latitude: 5.6, longitude: -0.2 } },
        ],
      }),
    )

    const result = await searchGhanaPlaces('Kaneshie', null, 'test-key')

    expect(result).toEqual({
      ok: true,
      results: [
        {
          title: 'Kaneshie Market',
          address: 'Kaneshie, Accra, Ghana',
          lat: 5.5735,
          lng: -0.2456,
          placeId: 'ChIJkaneshie',
        },
        { title: 'Address only', address: 'Address only', lat: 5.6, lng: -0.2, placeId: null },
      ],
    })
  })

  it('reads the single place_results shape (query resolves to one place)', () => {
    const results = normalizeResults({
      search_information: {
        local_results_state: 'Showing results for type: "place" instead of type: "search"',
      },
      place_results: {
        title: 'Kaneshie Market Complex',
        address: 'Mantse Akramah St, Accra',
        country: 'Ghana',
        gps_coordinates: { latitude: 5.5667389, longitude: -0.236487 },
        place_id: 'ChIJhXJ9cuOZ3w8RbCYr-pOdHy8',
      },
    })
    expect(results).toEqual([
      {
        title: 'Kaneshie Market Complex',
        address: 'Mantse Akramah St, Accra',
        lat: 5.5667389,
        lng: -0.236487,
        placeId: 'ChIJhXJ9cuOZ3w8RbCYr-pOdHy8',
      },
    ])
  })

  it('hard-filters results to Ghana, keeping unlabelled ones', () => {
    const results = normalizeResults({
      local_results: [
        { title: 'Lomé spot', country: 'Togo', gps_coordinates: { latitude: 6.1, longitude: 1.2 } },
        { title: 'Accra spot', country: 'Ghana', gps_coordinates: { latitude: 5.6, longitude: -0.2 } },
        { title: 'Unlabelled', gps_coordinates: { latitude: 5.7, longitude: -0.3 } },
      ],
    })
    expect(results.map((r) => r.title)).toEqual(['Accra spot', 'Unlabelled'])
  })

  it('caps the result list at five places', () => {
    const results = normalizeResults({
      local_results: Array.from({ length: 8 }, (_, i) => ({
        title: `Place ${i}`,
        country: 'Ghana',
        gps_coordinates: { latitude: 5.5 + i / 100, longitude: -0.2 },
      })),
    })
    expect(results).toHaveLength(5)
  })

  it('treats an empty Google Maps result set as success with no places', async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse({ search_information: { local_results_state: 'Fully empty' }, error: 'no results' }),
    )
    expect(await searchGhanaPlaces('Kaneshie', null, 'test-key')).toEqual({ ok: true, results: [] })
  })

  it('maps upstream failures to safe reasons', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ error: 'Invalid API key' }, 401))
    expect(await searchGhanaPlaces('Kaneshie', null, 'test-key')).toEqual({
      ok: false,
      reason: 'not_configured',
    })

    fetchMock.mockResolvedValueOnce(jsonResponse({ error: 'run out of searches' }, 429))
    expect(await searchGhanaPlaces('Kaneshie', null, 'test-key')).toEqual({ ok: false, reason: 'quota' })

    fetchMock.mockResolvedValueOnce(jsonResponse({ error: 'boom' }, 500))
    expect(await searchGhanaPlaces('Kaneshie', null, 'test-key')).toEqual({ ok: false, reason: 'upstream' })
  })

  it('maps network failures and error statuses to upstream', async () => {
    fetchMock.mockRejectedValueOnce(new Error('network down'))
    expect(await searchGhanaPlaces('Kaneshie', null, 'test-key')).toEqual({ ok: false, reason: 'upstream' })

    fetchMock.mockResolvedValueOnce(jsonResponse({ search_metadata: { status: 'Error' } }))
    expect(await searchGhanaPlaces('Kaneshie', null, 'test-key')).toEqual({ ok: false, reason: 'upstream' })
  })

  it('does not call SerpApi without a key or for short queries', async () => {
    expect(await searchGhanaPlaces('Kaneshie', null, '')).toEqual({ ok: false, reason: 'not_configured' })
    expect(await searchGhanaPlaces('ab', null, 'test-key')).toEqual({ ok: true, results: [] })
    expect(fetchMock).not.toHaveBeenCalled()
  })
})

describe('GET /api/maps-search', () => {
  it('returns normalized results as JSON — never the SPA shell', async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse({
        local_results: [
          {
            title: 'Kaneshie Market',
            address: 'Kaneshie, Accra, Ghana',
            country: 'Ghana',
            gps_coordinates: { latitude: 5.5735, longitude: -0.2456 },
            place_id: 'ChIJkaneshie',
          },
        ],
      }),
    )

    const response = await middleware(
      new Request('https://www.travioghana.com/api/maps-search?q=Kaneshie&lat=5.57&lng=-0.24'),
    )

    expect(response).toBeInstanceOf(Response)
    expect(response!.status).toBe(200)
    expect(response!.headers.get('Content-Type')).toContain('application/json')
    expect(response!.headers.get('x-middleware-rewrite')).toBeNull()
    const body = await response!.json()
    expect(body.ok).toBe(true)
    expect(body.results[0].title).toBe('Kaneshie Market')
    const url = new URL(fetchMock.mock.calls[0][0] as string)
    expect(url.searchParams.get('ll')).toBe('@5.57,-0.24,12z')
  })

  it('rejects invalid queries and origins with 400', async () => {
    const shortQuery = await middleware(
      new Request('https://www.travioghana.com/api/maps-search?q=ab'),
    )
    expect(shortQuery!.status).toBe(400)

    const oneSidedOrigin = await middleware(
      new Request('https://www.travioghana.com/api/maps-search?q=Kaneshie&lat=5.57'),
    )
    expect(oneSidedOrigin!.status).toBe(400)

    const outOfRange = await middleware(
      new Request('https://www.travioghana.com/api/maps-search?q=Kaneshie&lat=95&lng=-0.24'),
    )
    expect(outOfRange!.status).toBe(400)
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('rejects non-GET requests with 405', async () => {
    const response = await handleMapsSearch(
      new Request('https://www.travioghana.com/api/maps-search?q=Kaneshie', { method: 'POST' }),
    )
    expect(response.status).toBe(405)
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('reports not_configured (and never calls SerpApi) without the env key', async () => {
    delete process.env.VITE_SERP_API_KEY
    delete process.env.SERPAPI_API_KEY
    const response = await middleware(
      new Request('https://www.travioghana.com/api/maps-search?q=Kaneshie'),
    )
    const body = await response!.json()
    expect(body).toEqual({ ok: false, reason: 'not_configured' })
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('still accepts the legacy SERPAPI_API_KEY name', async () => {
    delete process.env.VITE_SERP_API_KEY
    process.env.SERPAPI_API_KEY = 'legacy-key'
    fetchMock.mockResolvedValueOnce(jsonResponse({ local_results: [] }))

    await middleware(new Request('https://www.travioghana.com/api/maps-search?q=Kaneshie'))

    const url = new URL(fetchMock.mock.calls[0][0] as string)
    expect(url.searchParams.get('api_key')).toBe('legacy-key')
  })
})
