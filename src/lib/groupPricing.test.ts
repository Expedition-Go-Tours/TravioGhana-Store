import { describe, it, expect } from 'vitest'
import {
  clampGroupHeadcount,
  groupBandLabel,
  groupPricingRange,
  lowestGroupBandPrice,
  matchGroupBand,
} from './groupPricing'

const bands = [
  { from: 1, to: 2, price: 100 },
  { from: 3, to: 5, price: 250 },
  { from: 6, to: 10, price: 450 },
]

describe('groupPricingRange', () => {
  it('returns the valid headcount range across bands', () => {
    expect(groupPricingRange(bands)).toEqual({ min: 1, max: 10 })
  })

  it('falls back to a safe range when there are no bands', () => {
    expect(groupPricingRange([])).toEqual({ min: 1, max: 50 })
    expect(groupPricingRange(undefined as never)).toEqual({ min: 1, max: 50 })
  })
})

describe('clampGroupHeadcount', () => {
  it('keeps an in-range headcount unchanged', () => {
    expect(clampGroupHeadcount(4, bands)).toBe(4)
  })

  it('clamps a headcount above the largest band down to the max', () => {
    expect(clampGroupHeadcount(12, bands)).toBe(10)
  })

  it('clamps a headcount below the smallest band up to the min', () => {
    expect(clampGroupHeadcount(0, bands)).toBe(1)
  })

  it('handles bands with an open-ended (infinite) upper bound', () => {
    expect(clampGroupHeadcount(200, [{ from: 6, to: Infinity, price: 450 }])).toBe(50)
  })
})

describe('matchGroupBand', () => {
  it('finds the band for the current headcount', () => {
    expect(matchGroupBand(2, bands)?.price).toBe(100)
    expect(matchGroupBand(5, bands)?.price).toBe(250)
    expect(matchGroupBand(10, bands)?.price).toBe(450)
  })

  it('returns undefined when no band covers the headcount', () => {
    expect(matchGroupBand(11, bands)).toBeUndefined()
  })
})

describe('groupBandLabel', () => {
  it('renders a closed range', () => {
    expect(groupBandLabel({ from: 3, to: 5, price: 250 })).toBe('3-5')
  })

  it('renders an open-ended range with a "+"', () => {
    expect(groupBandLabel({ from: 6, to: Infinity, price: 450 })).toBe('6+')
  })

  it('renders a single-headcount band as just the number', () => {
    expect(groupBandLabel({ from: 2, to: 2, price: 300 })).toBe('2')
  })

  it('returns an empty string for a missing band', () => {
    expect(groupBandLabel(undefined)).toBe('')
  })
})

describe('lowestGroupBandPrice', () => {
  it('returns the cheapest band price', () => {
    expect(lowestGroupBandPrice(bands)).toBe(100)
  })

  it('returns undefined when there are no bands', () => {
    expect(lowestGroupBandPrice([])).toBeUndefined()
  })
})
