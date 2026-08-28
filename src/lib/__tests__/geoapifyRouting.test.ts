import { describe, it, expect, vi, afterEach } from 'vitest'
import {
  appleMapsDirectionsUrl,
  fetchGeoapifyRoute,
  formatRouteDistance,
  formatRouteDuration,
  googleMapsDirectionsUrl,
} from '../geoapifyRouting'

afterEach(() => {
  vi.unstubAllEnvs()
  vi.restoreAllMocks()
})

const ROUTE_FEATURE = {
  geometry: {
    coordinates: [
      [-0.1748732, 5.6214906],
      [-0.19, 5.63],
      [-0.21, 5.65],
    ],
  },
  properties: {
    distance: 5234,
    time: 912,
    legs: [
      {
        steps: [
          { instruction: '<b>Head</b> north', distance: 1200, time: 180, mode: 'drive' },
          { instruction: 'Turn left onto Spintex Road', distance: 4034, time: 732, mode: 'drive' },
        ],
      },
    ],
  },
}

describe('fetchGeoapifyRoute', () => {
  it('builds the routing URL (lon,lat waypoints) and parses the GeoJSON route', async () => {
    vi.stubEnv('VITE_GEOAPIFY_API_KEY', 'test-key')
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => ({ features: [ROUTE_FEATURE] }) }))

    const route = await fetchGeoapifyRoute({ lat: 5.6214906, lng: -0.1748732 }, { lat: 5.65, lng: -0.21 }, 'drive')

    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining('https://api.geoapify.com/v1/routing'),
    )
    expect(fetch).toHaveBeenCalledWith(expect.stringContaining('waypoints=-0.1748732,5.6214906|-0.21,5.65'))
    expect(fetch).toHaveBeenCalledWith(expect.stringContaining('mode=drive'))
    expect(fetch).toHaveBeenCalledWith(expect.stringContaining('apiKey=test-key'))

    expect(route).toEqual({
      geometry: ROUTE_FEATURE.geometry.coordinates,
      distanceM: 5234,
      durationSec: 912,
      steps: [
        { instruction: '<b>Head</b> north', distanceM: 1200, durationSec: 180, mode: 'drive' },
        { instruction: 'Turn left onto Spintex Road', distanceM: 4034, durationSec: 732, mode: 'drive' },
      ],
    })
  })

  it('returns null without a key (no network call)', async () => {
    vi.stubEnv('VITE_GEOAPIFY_API_KEY', '')
    const spy = vi.fn()
    vi.stubGlobal('fetch', spy)
    expect(await fetchGeoapifyRoute({ lat: 1, lng: 2 }, { lat: 3, lng: 4 })).toBeNull()
    expect(spy).not.toHaveBeenCalled()
  })

  it('returns null on a non-ok response', async () => {
    vi.stubEnv('VITE_GEOAPIFY_API_KEY', 'test-key')
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 429 }))
    expect(await fetchGeoapifyRoute({ lat: 1, lng: 2 }, { lat: 3, lng: 4 })).toBeNull()
  })

  it('returns null on a network failure', async () => {
    vi.stubEnv('VITE_GEOAPIFY_API_KEY', 'test-key')
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('down')))
    expect(await fetchGeoapifyRoute({ lat: 1, lng: 2 }, { lat: 3, lng: 4 })).toBeNull()
  })

  it('returns null when the response has no route geometry', async () => {
    vi.stubEnv('VITE_GEOAPIFY_API_KEY', 'test-key')
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => ({ features: [] }) }))
    expect(await fetchGeoapifyRoute({ lat: 1, lng: 2 }, { lat: 3, lng: 4 })).toBeNull()
  })
})

describe('format helpers', () => {
  it('formats durations', () => {
    expect(formatRouteDuration(45)).toBe('1 min')
    expect(formatRouteDuration(600)).toBe('10 min')
    expect(formatRouteDuration(3600)).toBe('1 h')
    expect(formatRouteDuration(4500)).toBe('1 h 15 min')
  })

  it('formats distances', () => {
    expect(formatRouteDistance(800)).toBe('800 m')
    expect(formatRouteDistance(5234)).toBe('5.2 km')
  })
})

describe('deep-link builders', () => {
  it('builds a Google Maps URL with origin + mode', () => {
    const url = googleMapsDirectionsUrl(
      { lat: 5.6214906, lng: -0.1748732 },
      { lat: 5.65, lng: -0.21 },
      'walk',
    )
    expect(url).toContain('https://www.google.com/maps/dir/')
    expect(url).toContain('destination=5.65,-0.21')
    expect(url).toContain('origin=5.6214906,-0.1748732')
    expect(url).toContain('travelmode=walking')
  })

  it('builds a Google Maps URL without origin', () => {
    const url = googleMapsDirectionsUrl(null, { lat: 5.65, lng: -0.21 }, 'drive')
    expect(url).not.toContain('origin=')
    expect(url).toContain('travelmode=driving')
  })

  it('builds an Apple Maps URL with origin', () => {
    const url = appleMapsDirectionsUrl({ lat: 5.6, lng: -0.19 }, { lat: 5.65, lng: -0.21 })
    expect(url).toContain('http://maps.apple.com/')
    expect(url).toContain('daddr=5.65,-0.21')
    expect(url).toContain('saddr=5.6,-0.19')
  })
})
