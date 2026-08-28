import { afterEach, describe, expect, it, vi } from 'vitest'
import { reverseGeocode } from '../locations'
import { fetchWithAuth } from '../api'

vi.mock('../api', () => ({
  fetchWithAuth: vi.fn(),
}))

const mockFetch = vi.mocked(fetchWithAuth)

describe('reverseGeocode', () => {
  afterEach(() => {
    vi.clearAllMocks()
  })

  it('returns the first normalized result on success', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        status: 'success',
        data: {
          results: [
            {
              formatted: 'Osu, Accra, Ghana',
              city: 'Accra',
              country: 'Ghana',
              region: 'Greater Accra Region',
              latitude: 5.5555,
              longitude: -0.1877,
            },
          ],
        },
      }),
    } as unknown as Response)

    const result = await reverseGeocode(5.5555, -0.1877)
    expect(mockFetch).toHaveBeenCalledWith('/locations/reverse?lat=5.5555&lng=-0.1877')
    expect(result).toEqual({
      formatted: 'Osu, Accra, Ghana',
      latitude: 5.5555,
      longitude: -0.1877,
      city: 'Accra',
      country: 'Ghana',
      region: 'Greater Accra Region',
    })
  })

  it('returns null when the request is not ok', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      json: async () => ({}),
    } as unknown as Response)

    expect(await reverseGeocode(5.5, -0.18)).toBeNull()
  })

  it('returns null when the body has no results', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ status: 'success', data: { results: [] } }),
    } as unknown as Response)

    expect(await reverseGeocode(5.5, -0.18)).toBeNull()
  })

  it('returns null when the fetch rejects', async () => {
    mockFetch.mockRejectedValueOnce(new Error('network down'))

    expect(await reverseGeocode(5.5, -0.18)).toBeNull()
  })
})