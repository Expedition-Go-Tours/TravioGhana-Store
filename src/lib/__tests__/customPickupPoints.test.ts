import { describe, expect, it } from 'vitest'
import { CUSTOM_POINT_DEDUPE_RADIUS_M, customPointStatus, isDuplicateCustomPoint } from '../customPickupPoints'
import type { PickupAreaShape } from '../pickupZone'

// A small square polygon around (5.6, -0.2), plus an exclusion notch.
const ZONE: [number, number][] = [
  [5.62, -0.22],
  [5.62, -0.18],
  [5.58, -0.18],
  [5.58, -0.22],
]
const EXCLUSION: [number, number][] = [
  [5.605, -0.195],
  [5.605, -0.185],
  [5.595, -0.185],
  [5.595, -0.195],
]

const areas: PickupAreaShape[] = [
  {
    name: 'Downtown',
    lat: 5.6,
    lng: -0.2,
    polygon: ZONE,
    exclusions: [EXCLUSION],
  },
]

const locationOnlyAreas: PickupAreaShape[] = [{ name: 'Osu', lat: 5.596, lng: -0.183 }]

describe('customPointStatus', () => {
  it('returns in_zone for a spot inside a drawn pickup zone', () => {
    expect(customPointStatus(5.6, -0.2, areas)).toBe('in_zone')
    expect(customPointStatus(5.61, -0.21, areas)).toBe('in_zone')
  })

  it('returns outside for a spot outside every drawn zone', () => {
    expect(customPointStatus(5.63, -0.2, areas)).toBe('outside')
    expect(customPointStatus(5.6, -0.25, areas)).toBe('outside')
  })

  it('returns outside for a spot inside an exclusion zone', () => {
    expect(customPointStatus(5.6, -0.19, areas)).toBe('outside')
  })

  it('geofences location-only areas to their radius circle', () => {
    // The area's own saved point (centre) — inside the 5 km circle.
    expect(customPointStatus(5.596, -0.183, locationOnlyAreas)).toBe('in_zone')
    // ~6 km north of the centre — beyond the 5 km circle.
    expect(customPointStatus(5.65, -0.183, locationOnlyAreas)).toBe('outside')
  })

  it('returns no_zones only for tours without any geographic data', () => {
    expect(customPointStatus(5.596, -0.183, [])).toBe('no_zones')
    expect(customPointStatus(5.596, -0.183, undefined as unknown as PickupAreaShape[])).toBe('no_zones')
    expect(customPointStatus(5.596, -0.183, [{ name: 'Legacy' }])).toBe('no_zones')
  })
})

describe('isDuplicateCustomPoint', () => {
  const points = [{ lat: 5.6, lng: -0.2 }]

  it('is true within the dedupe radius', () => {
    expect(isDuplicateCustomPoint(5.6002, -0.2001, points)).toBe(true)
    // ~44 m away — just inside the 50 m radius.
    expect(isDuplicateCustomPoint(5.6004, -0.2, points)).toBe(true)
  })

  it('is false beyond the dedupe radius', () => {
    // ~110 m away.
    expect(isDuplicateCustomPoint(5.601, -0.2, points)).toBe(false)
  })

  it('is false for an empty list and tolerates null coordinates', () => {
    expect(isDuplicateCustomPoint(5.6, -0.2, [])).toBe(false)
    expect(isDuplicateCustomPoint(5.6, -0.2, [{ lat: null, lng: null }])).toBe(false)
  })

  it('respects a custom radius', () => {
    expect(isDuplicateCustomPoint(5.601, -0.2, points, 150)).toBe(true)
    expect(isDuplicateCustomPoint(5.601, -0.2, points, CUSTOM_POINT_DEDUPE_RADIUS_M)).toBe(false)
  })
})
