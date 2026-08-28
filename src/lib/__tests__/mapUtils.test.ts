import { describe, it, expect, afterEach } from 'vitest'
import {
  DEFAULT_CENTER, TILE_STYLE, pinMatchesSelection, toNumber, warmMapResources,
} from '../mapUtils'

describe('mapUtils tile style', () => {
  it('uses the OpenFreeMap Liberty style (keyless, matches the supplier platform)', () => {
    expect(TILE_STYLE).toBe('https://tiles.openfreemap.org/styles/liberty')
  })

  it('warmMapResources preconnects to the OpenFreeMap tile host', () => {
    warmMapResources()
    const links = Array.from(document.querySelectorAll('link[rel="preconnect"]'))
    const hosts = links.map((l) => l.getAttribute('href'))
    expect(hosts).toContain('https://tiles.openfreemap.org')
  })
})

describe('mapUtils misc', () => {
  afterEach(() => {
    document.querySelectorAll('link[rel="preconnect"]').forEach((l) => l.remove())
  })

  it('DEFAULT_CENTER is Accra', () => {
    expect(DEFAULT_CENTER).toEqual([-0.187, 5.6037])
  })
})

describe('mapUtils toNumber', () => {
  it('parses numeric values', () => {
    expect(toNumber(5.62)).toBe(5.62)
    expect(toNumber('5.62')).toBe(5.62)
    expect(toNumber(0)).toBe(0)
  })

  it('rejects nullish/empty inputs instead of coercing to 0', () => {
    // Number(null) === 0 — a phantom (0, 0) pin used to break the maps.
    expect(toNumber(null)).toBeNull()
    expect(toNumber(undefined)).toBeNull()
    expect(toNumber('')).toBeNull()
  })

  it('rejects non-finite values', () => {
    expect(toNumber('abc')).toBeNull()
    expect(toNumber(NaN)).toBeNull()
    expect(toNumber(Infinity)).toBeNull()
  })
})

describe('mapUtils pinMatchesSelection', () => {
  it('matches by label', () => {
    expect(pinMatchesSelection({ lat: 5.56, lng: -0.18, label: 'Osu' }, { lat: 5.56, lng: -0.18, label: 'Osu' })).toBe(true)
  })

  it('matches by tight coordinates even when labels drift', () => {
    // Same spot, but the label differs (name vs. geocoded address).
    expect(pinMatchesSelection({ lat: 5.56, lng: -0.18, label: 'Osu' }, { lat: 5.560001, lng: -0.180001, label: 'Osu, Accra' })).toBe(true)
  })

  it('does not match a different point', () => {
    expect(pinMatchesSelection({ lat: 5.56, lng: -0.18, label: 'Osu' }, { lat: 5.57, lng: -0.17, label: 'Labone' })).toBe(false)
  })

  it('returns false when nothing is selected', () => {
    expect(pinMatchesSelection({ lat: 5.56, lng: -0.18, label: 'Osu' }, null)).toBe(false)
    expect(pinMatchesSelection({ lat: 5.56, lng: -0.18, label: 'Osu' }, undefined)).toBe(false)
  })
})
