import { describe, it, expect } from 'vitest'
import { findActiveTier, hasTieredPricing, resolveTierPrice, tierRangeLabel } from './tierPricing'

const tieredAdult = {
  price: 50,
  tiers: [
    { from: 1, to: 2, pricePerPerson: 60 },
    { from: 3, to: 5, pricePerPerson: 45 },
    { from: 6, to: Infinity, pricePerPerson: 35 },
  ],
}

describe('findActiveTier', () => {
  it('finds the tier matching the current total traveler count', () => {
    expect(findActiveTier(tieredAdult, 1)?.pricePerPerson).toBe(60)
    expect(findActiveTier(tieredAdult, 4)?.pricePerPerson).toBe(45)
    expect(findActiveTier(tieredAdult, 20)?.pricePerPerson).toBe(35)
  })

  it('returns undefined when the group has no tiers', () => {
    expect(findActiveTier({ price: 50 }, 4)).toBeUndefined()
  })

  it('returns undefined when the group itself is missing', () => {
    expect(findActiveTier(undefined, 4)).toBeUndefined()
  })
})

describe('resolveTierPrice', () => {
  it('uses the matching tier price over the flat category price', () => {
    expect(resolveTierPrice(tieredAdult, 4, 0)).toBe(45)
  })

  it('falls back to the flat category price when no tier matches', () => {
    const noMatch = { price: 50, tiers: [{ from: 10, to: 20, pricePerPerson: 30 }] }
    expect(resolveTierPrice(noMatch, 4, 0)).toBe(50)
  })

  it('falls back to the provided default when there is no category at all', () => {
    expect(resolveTierPrice(undefined, 4, 99)).toBe(99)
  })

  it('mirrors the backend tie-matching boundary semantics (inclusive from/to)', () => {
    // Boundary at exactly 2 and 3 travelers should land on adjacent tiers.
    expect(resolveTierPrice(tieredAdult, 2, 0)).toBe(60)
    expect(resolveTierPrice(tieredAdult, 3, 0)).toBe(45)
  })
})

describe('hasTieredPricing', () => {
  it('is true when tiers are defined and non-empty', () => {
    expect(hasTieredPricing(tieredAdult)).toBe(true)
  })

  it('is false when tiers are absent or empty', () => {
    expect(hasTieredPricing({ price: 50 })).toBe(false)
    expect(hasTieredPricing({ price: 50, tiers: [] })).toBe(false)
    expect(hasTieredPricing(undefined)).toBe(false)
  })
})

describe('tierRangeLabel', () => {
  it('renders a closed range', () => {
    expect(tierRangeLabel({ from: 3, to: 5, pricePerPerson: 45 })).toBe('3-5')
  })

  it('renders an open-ended range with a "+"', () => {
    expect(tierRangeLabel({ from: 6, to: Infinity, pricePerPerson: 35 })).toBe('6+')
  })

  it('renders a single-headcount tier as just the number', () => {
    expect(tierRangeLabel({ from: 2, to: 2, pricePerPerson: 40 })).toBe('2')
  })

  it('returns an empty string for a missing tier', () => {
    expect(tierRangeLabel(undefined)).toBe('')
  })
})
