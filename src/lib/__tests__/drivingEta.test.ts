import { describe, expect, it } from 'vitest'
import { estimateDrivingMinutes, formatDurationHM, straightLineKm } from '../drivingEta'

describe('formatDurationHM', () => {
  it('formats under an hour as minutes', () => {
    expect(formatDurationHM(0)).toBe('1 min')
    expect(formatDurationHM(45)).toBe('45 min')
    expect(formatDurationHM(59)).toBe('59 min')
  })

  it('formats hours and minutes', () => {
    expect(formatDurationHM(60)).toBe('1 h')
    expect(formatDurationHM(75)).toBe('1 h 15 min')
    expect(formatDurationHM(120)).toBe('2 h')
    expect(formatDurationHM(125)).toBe('2 h 5 min')
  })

  it('rounds fractional minutes', () => {
    expect(formatDurationHM(74.6)).toBe('1 h 15 min')
  })
})

describe('straightLineKm', () => {
  it('is ~111 km per degree of latitude', () => {
    const km = straightLineKm({ lat: 0, lng: 0 }, { lat: 1, lng: 0 })
    expect(km).toBeGreaterThan(110)
    expect(km).toBeLessThan(112)
  })

  it('is zero for identical points', () => {
    expect(straightLineKm({ lat: 5.6, lng: -0.18 }, { lat: 5.6, lng: -0.18 })).toBe(0)
  })
})

describe('estimateDrivingMinutes', () => {
  it('estimates ~35 km/h', () => {
    expect(estimateDrivingMinutes(35)).toBe(60)
    expect(estimateDrivingMinutes(17.5)).toBe(30)
  })

  it('never returns zero', () => {
    expect(estimateDrivingMinutes(0.1)).toBeGreaterThanOrEqual(1)
  })
})
