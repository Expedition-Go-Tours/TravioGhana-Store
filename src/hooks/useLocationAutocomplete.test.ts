import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { act, renderHook } from '@testing-library/react'
import { useLocationAutocomplete } from './useLocationAutocomplete'
import { geoapifyAutocomplete } from '../lib/geoapify'
import { fetchWithAuth } from '../lib/api'
import type { LocationResult } from './useLocationAutocomplete'

vi.mock('../lib/geoapify', () => ({
  geoapifyAutocomplete: vi.fn(),
}))

vi.mock('../lib/api', () => ({
  fetchWithAuth: vi.fn(),
}))

const mockGeoapify = vi.mocked(geoapifyAutocomplete)
const mockFetchWithAuth = vi.mocked(fetchWithAuth)

const geoapifyResult: LocationResult = {
  formatted: 'Accra Mall, Spintex Road, Accra, Ghana',
  latitude: 5.6199791,
  longitude: -0.1731861,
  city: 'Accra',
  country: 'Ghana',
  region: 'Greater Accra Region',
  countryCode: 'gh',
  postcode: 'GD-110-6313',
  street: 'Spintex Road',
  housenumber: null,
  category: null,
  source: 'geoapify',
  confidence: 0.9,
}

const backendResult: LocationResult = {
  ...geoapifyResult,
  formatted: 'Accra Mall (backend), Spintex Road, Accra, Ghana',
  source: 'backend',
}

async function flush() {
  await act(async () => {
    vi.advanceTimersByTime(600)
  })
}

describe('useLocationAutocomplete', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('searches Geoapify first and surfaces its suggestions', async () => {
    mockGeoapify.mockResolvedValue([geoapifyResult])
    const { result } = renderHook(() => useLocationAutocomplete())

    act(() => {
      result.current.search('Accra Mall')
    })
    await flush()

    expect(mockGeoapify).toHaveBeenCalledWith('Accra Mall', 5)
    expect(mockFetchWithAuth).not.toHaveBeenCalled()
    expect(result.current.results).toHaveLength(1)
    expect(result.current.results[0]).toMatchObject({ source: 'geoapify', formatted: geoapifyResult.formatted })
    expect(result.current.error).toBeNull()
  })

  it('falls back to the backend location service when Geoapify returns nothing', async () => {
    mockGeoapify.mockResolvedValue([])
    mockFetchWithAuth.mockResolvedValue({
      ok: true,
      json: async () => ({ data: { results: [backendResult] } }),
    } as Response)
    const { result } = renderHook(() => useLocationAutocomplete())

    act(() => {
      result.current.search('Kaneshie Market')
    })
    await flush()

    expect(mockGeoapify).toHaveBeenCalled()
    expect(mockFetchWithAuth).toHaveBeenCalledWith('/locations/autocomplete?q=Kaneshie%20Market&limit=5')
    expect(result.current.results[0]).toMatchObject({ source: 'backend' })
  })

  it('does not search for an empty query', async () => {
    const { result } = renderHook(() => useLocationAutocomplete())

    act(() => {
      result.current.search('   ')
    })

    expect(mockGeoapify).not.toHaveBeenCalled()
    expect(result.current.results).toEqual([])
    expect(result.current.loading).toBe(false)
  })

  it('clears results and cancels pending work', async () => {
    mockGeoapify.mockResolvedValue([geoapifyResult])
    const { result } = renderHook(() => useLocationAutocomplete())

    act(() => {
      result.current.search('Osu')
    })
    await flush()
    expect(result.current.results).toHaveLength(1)

    act(() => {
      result.current.clear()
    })
    expect(result.current.results).toHaveLength(0)
    expect(result.current.loading).toBe(false)
  })
})
