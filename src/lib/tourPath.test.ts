import { describe, it, expect } from 'vitest'
import { tourPath, bookingPath } from './tourPath'

describe('tourPath', () => {
  it('builds the canonical id + slug form', () => {
    expect(tourPath('cmuefjdhj008gr44h8flybaj7', 'cape-coast-castle'))
      .toBe('/tour/cmuefjdhj008gr44h8flybaj7/cape-coast-castle')
  })

  it('falls back to the slug alone when the id is unknown (static/mock cards)', () => {
    expect(tourPath(undefined, 'cape-coast-castle')).toBe('/tour/cape-coast-castle')
  })

  it('falls back to the id alone when the slug is unknown', () => {
    expect(tourPath('cmuefjdhj008gr44h8flybaj7')).toBe('/tour/cmuefjdhj008gr44h8flybaj7')
  })

  it('encodes both segments', () => {
    expect(tourPath('a b', 'c/d')).toBe('/tour/a%20b/c%2Fd')
  })
})

describe('bookingPath', () => {
  it('builds the canonical /{id}/{slug}/booking form', () => {
    expect(bookingPath('cmuefjdhj008gr44h8flybaj7', 'cape-coast-castle'))
      .toBe('/cmuefjdhj008gr44h8flybaj7/cape-coast-castle/booking')
  })

  it('reuses the id for the slug segment when there is no slug', () => {
    expect(bookingPath('cmuefjdhj008gr44h8flybaj7'))
      .toBe('/cmuefjdhj008gr44h8flybaj7/cmuefjdhj008gr44h8flybaj7/booking')
  })
})
