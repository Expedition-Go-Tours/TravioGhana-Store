import { afterEach, describe, expect, it, vi } from 'vitest'
import { clearResolvedPointCache, resolveTourPoints, resolvedPointsToTour } from '../resolvePoints'
import { fetchWithAuth } from '../api'

vi.mock('../api', () => ({
  fetchWithAuth: vi.fn(),
}))

const mockFetch = vi.mocked(fetchWithAuth)

const ok = (results: unknown[]) =>
  ({ ok: true, json: async () => ({ status: 'success', data: { results } }) }) as unknown as Response

describe('resolveTourPoints', () => {
  afterEach(() => {
    vi.clearAllMocks()
    clearResolvedPointCache()
  })

  it('keeps points that already have coordinates', async () => {
    const points = await resolveTourPoints({
      meetingMode: 'pickup',
      pickupLocations: [{ name: 'Labone', lat: 5.568, lng: -0.169 }],
    })
    expect(points).toHaveLength(1)
    expect(points[0]).toMatchObject({ kind: 'point', name: 'Labone', lat: 5.568, lng: -0.169, unresolved: false })
    expect(mockFetch).not.toHaveBeenCalled()
  })

  it('drops leftover pickup locations when pickup areas exist', async () => {
    const points = await resolveTourPoints({
      meetingMode: 'pickup',
      pickupAreas: [{ name: 'Osu', lat: 5.555, lng: -0.187, time: '0-30' }],
      pickupLocations: [{ name: 'Labone', lat: 5.568, lng: -0.169 }],
    })
    expect(points).toHaveLength(1)
    expect(points[0]).toMatchObject({ kind: 'zone', name: 'Osu', lat: 5.555, lng: -0.187, unresolved: false })
    expect(mockFetch).not.toHaveBeenCalled()
  })

  it('carries the area radiusKm through for location-only pickup zones', async () => {
    const points = await resolveTourPoints({
      meetingMode: 'pickup',
      pickupAreas: [{ name: 'Oasis Park', lat: 5.626746, lng: -0.169995, radiusKm: 15 }],
    })
    expect(points).toHaveLength(1)
    expect(points[0]).toMatchObject({ kind: 'zone', radiusKm: 15 })
    expect(mockFetch).not.toHaveBeenCalled()
  })

  it('geocodes points that lack coordinates via the backend search endpoint', async () => {
    mockFetch.mockResolvedValueOnce(
      ok([{ formatted: 'Osu, Accra, Ghana', latitude: 5.5555, longitude: -0.1877 }]),
    )
    const points = await resolveTourPoints({
      meetingMode: 'pickup',
      pickupAreas: [{ name: 'Osu', address: 'Osu, Accra' }],
    })
    expect(mockFetch).toHaveBeenCalledWith('/locations/search?q=Osu%2C%20Accra&limit=1')
    expect(points[0]).toMatchObject({
      kind: 'zone',
      name: 'Osu',
      address: 'Osu, Accra, Ghana',
      lat: 5.5555,
      lng: -0.1877,
      unresolved: false,
    })
  })

  it('flags points as unresolved when geocoding returns nothing', async () => {
    mockFetch.mockResolvedValueOnce(ok([]))
    const points = await resolveTourPoints({
      meetingMode: 'pickup',
      pickupLocations: [{ name: 'Unknown Place' }],
    })
    expect(points[0]).toMatchObject({ kind: 'point', name: 'Unknown Place', lat: null, lng: null, unresolved: true })
  })

  it('caches geocode results across calls', async () => {
    mockFetch.mockResolvedValueOnce(ok([{ formatted: 'Accra, Ghana', latitude: 5.6037, longitude: -0.187 }]))
    const first = await resolveTourPoints({ meetingMode: 'pickup', pickupAreas: [{ name: 'A', address: 'Accra, Ghana' }] })
    const second = await resolveTourPoints({ meetingMode: 'pickup', pickupAreas: [{ name: 'A', address: 'Accra, Ghana' }] })
    expect(first[0].lat).toBe(5.6037)
    expect(second[0].lat).toBe(5.6037)
    expect(mockFetch).toHaveBeenCalledTimes(1)
  })

  it('handles a meeting-point tour', async () => {
    const points = await resolveTourPoints({
      meetingMode: 'meeting_point',
      meetingPoint: 'Sankofa Monument',
      meetingPointLat: 5.5451,
      meetingPointLng: -0.1926,
    })
    expect(points).toHaveLength(1)
    expect(points[0]).toMatchObject({ kind: 'meeting', name: 'Sankofa Monument', lat: 5.5451, lng: -0.1926 })
  })

  it('returns an empty list for a null tour', async () => {
    expect(await resolveTourPoints(null)).toEqual([])
  })
})

describe('resolvedPointsToTour', () => {
  it('merges resolved points back into a tour-shaped object', async () => {
    const source = {
      meetingMode: 'pickup' as const,
      pickupAreas: [{ name: 'Zone A', lat: 1, lng: 2 }],
      pickupLocations: [{ name: 'Point B', lat: 3, lng: 4 }],
    }
    const points = await resolveTourPoints(source)
    const tour = resolvedPointsToTour(points, source)
    expect(tour.pickupAreas?.[0]).toMatchObject({ name: 'Zone A', lat: 1, lng: 2 })
    // Leftover locations are dropped when areas exist (area-based wins).
    expect(tour.pickupLocations).toEqual([])
  })

  it('filters out zone points with no coords and no polygon', () => {
    const points = [
      { id: 'zone-0', kind: 'zone' as const, name: 'Dead Zone', address: '', lat: null, lng: null, query: 'Dead Zone' },
      { id: 'zone-1', kind: 'zone' as const, name: 'Live Zone', address: '', lat: 5.5, lng: -0.1, query: 'Live Zone' },
    ]
    const tour = resolvedPointsToTour(points, { meetingMode: 'pickup' })
    expect(tour.pickupAreas).toHaveLength(1)
    expect(tour.pickupAreas?.[0]).toMatchObject({ name: 'Live Zone', lat: 5.5, lng: -0.1 })
  })

  it('preserves zone points with polygons even when lat/lng are null', () => {
    const polygon: [number, number][] = [[5.5, -0.1], [5.6, -0.1], [5.6, -0.2], [5.5, -0.2]]
    const points = [
      { id: 'zone-0', kind: 'zone' as const, name: 'Polygon Zone', address: '', lat: null, lng: null, query: 'Polygon Zone', polygon },
    ]
    const tour = resolvedPointsToTour(points, { meetingMode: 'pickup' })
    expect(tour.pickupAreas).toHaveLength(1)
    expect(tour.pickupAreas?.[0]).toMatchObject({ name: 'Polygon Zone', polygon })
  })

  it('round-trips the area radiusKm into the map tour for location-only zones', async () => {
    const source = {
      meetingMode: 'pickup' as const,
      pickupAreas: [{ name: 'Oasis Park', lat: 5.626746, lng: -0.169995, radiusKm: 15 }],
    }
    const points = await resolveTourPoints(source)
    const tour = resolvedPointsToTour(points, source)
    expect(tour.pickupAreas).toHaveLength(1)
    expect(tour.pickupAreas?.[0]).toMatchObject({ name: 'Oasis Park', lat: 5.626746, lng: -0.169995, radiusKm: 15 })
  })

  it('handles meetingMode === "none" gracefully', () => {
    const points = [
      { id: 'point-0', kind: 'point' as const, name: 'Spot A', address: '', lat: 5.5, lng: -0.1, query: 'Spot A' },
    ]
    const tour = resolvedPointsToTour(points, { meetingMode: 'none' })
    expect(tour.meetingMode).toBe('none')
    expect(tour.pickupAreas).toEqual([])
    expect(tour.pickupLocations).toMatchObject([{ name: 'Spot A' }])
  })
})