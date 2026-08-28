import { describe, it, expect, vi, afterEach } from 'vitest'
import { geoapifyAutocomplete, getGeoapifyApiKey } from '../geoapify'

describe('getGeoapifyApiKey', () => {
  it('reads VITE_GEOAPIFY_API_KEY from import.meta.env', () => {
    vi.stubEnv('VITE_GEOAPIFY_API_KEY', '  test-key-123  ')
    expect(getGeoapifyApiKey()).toBe('test-key-123')
  })

  it('returns an empty string when the key is missing', () => {
    vi.stubEnv('VITE_GEOAPIFY_API_KEY', '')
    expect(getGeoapifyApiKey()).toBe('')
  })
})

describe('geoapifyAutocomplete', () => {
  afterEach(() => {
    vi.unstubAllEnvs()
    vi.restoreAllMocks()
  })

  const feature = (overrides: Record<string, unknown> = {}) => ({
    properties: {
      formatted: 'Accra Mall, Spintex Road, Accra, Ghana',
      name: 'Accra Mall',
      city: 'Accra',
      country: 'Ghana',
      country_code: 'gh',
      state: 'Greater Accra',
      postcode: 'GD-110-6313',
      street: 'Spintex Road',
      housenumber: '18',
      category: 'shopping_mall',
      rank: { confidence: 0.95 },
      ...overrides,
    },
    geometry: { coordinates: [-0.1748732, 5.6214906] },
  })

  it('maps Geoapify GeoJSON features into LocationResult shape', async () => {
    vi.stubEnv('VITE_GEOAPIFY_API_KEY', 'test-key')
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ features: [feature(), feature({ formatted: 'Second Place' })] }),
      }),
    )

    const results = await geoapifyAutocomplete('Accra Mall', 5)

    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining('https://api.geoapify.com/v1/geocode/autocomplete'),
    )
    expect(fetch).toHaveBeenCalledWith(expect.stringContaining('text=Accra%20Mall'))
    expect(fetch).toHaveBeenCalledWith(expect.stringContaining('apiKey=test-key'))
    expect(fetch).toHaveBeenCalledWith(expect.stringContaining('limit=5'))

    expect(results).toHaveLength(2)
    expect(results[0]).toEqual({
      formatted: 'Accra Mall, Spintex Road, Accra, Ghana',
      latitude: 5.6214906,
      longitude: -0.1748732,
      city: 'Accra',
      country: 'Ghana',
      countryCode: 'gh',
      region: 'Greater Accra',
      postcode: 'GD-110-6313',
      street: 'Spintex Road',
      housenumber: '18',
      category: 'shopping_mall',
      source: 'geoapify',
      confidence: 0.95,
    })
  })

  it('drops features without coordinates gracefully', async () => {
    vi.stubEnv('VITE_GEOAPIFY_API_KEY', 'test-key')
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          features: [feature(), { properties: { formatted: 'No Coords' } }],
        }),
      }),
    )

    const results = await geoapifyAutocomplete('x', 5)
    expect(results).toHaveLength(1)
    expect(results[0].formatted).toBe('Accra Mall, Spintex Road, Accra, Ghana')
  })

  it('returns [] without a key (no network call)', async () => {
    vi.stubEnv('VITE_GEOAPIFY_API_KEY', '')
    const spy = vi.fn()
    vi.stubGlobal('fetch', spy)
    expect(await geoapifyAutocomplete('x', 5)).toEqual([])
    expect(spy).not.toHaveBeenCalled()
  })

  it('returns [] when the request fails', async () => {
    vi.stubEnv('VITE_GEOAPIFY_API_KEY', 'test-key')
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network down')))
    expect(await geoapifyAutocomplete('x', 5)).toEqual([])
  })

  it('returns [] on a non-ok response', async () => {
    vi.stubEnv('VITE_GEOAPIFY_API_KEY', 'test-key')
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 429 }))
    expect(await geoapifyAutocomplete('x', 5)).toEqual([])
  })

  it('returns [] when the response has no features array', async () => {
    vi.stubEnv('VITE_GEOAPIFY_API_KEY', 'test-key')
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => ({}) }))
    expect(await geoapifyAutocomplete('x', 5)).toEqual([])
  })
})
