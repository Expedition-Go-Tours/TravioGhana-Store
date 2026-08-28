import { describe, it, expect } from 'vitest'
import { lowestAdultRetailPrice, lowestAdultFromTravelerPricing } from './startingPrice'
import type { TravelerPricing } from './tourTypes'

describe('lowestAdultRetailPrice', () => {
  it('returns the lowest adult tier, ignoring cheaper child/infant rates', () => {
    const blob = {
      travelerDetails: {
        pricingModel: 'perPerson',
        pricingApproach: 'dependsOnAge',
        pricingCategories: [
          { name: 'Adult', price: 150, tiers: [
            { from: 1, to: 4, pricePerPerson: 150 },
            { from: 5, to: 9, pricePerPerson: 130 },
            { from: 10, to: 99, pricePerPerson: 110 },
          ] },
          { name: 'Child', price: 75 },
        ],
      },
      pricingSchedules: { schedules: [] },
    }
    expect(lowestAdultRetailPrice(blob)).toBe(110)
  })

  it('uses the adult base price when no tiers exist', () => {
    const blob = {
      travelerDetails: {
        pricingModel: 'perPerson',
        pricingApproach: 'dependsOnAge',
        pricingCategories: [
          { name: 'Adult', price: 100 },
          { name: 'Child', price: 60 },
        ],
      },
      pricingSchedules: { schedules: [] },
    }
    expect(lowestAdultRetailPrice(blob)).toBe(100)
  })

  it('falls back to the cheapest category when no adult category exists', () => {
    const blob = {
      travelerDetails: {
        pricingModel: 'perPerson',
        pricingApproach: 'dependsOnAge',
        pricingCategories: [{ name: 'Child', price: 75 }],
      },
      pricingSchedules: { schedules: [] },
    }
    expect(lowestAdultRetailPrice(blob)).toBe(75)
  })

  it('uses uniformPrice for sameForEveryone tours', () => {
    const blob = {
      travelerDetails: {
        pricingModel: 'perPerson',
        pricingApproach: 'sameForEveryone',
        uniformPrice: 75,
      },
      pricingSchedules: { schedules: [] },
    }
    expect(lowestAdultRetailPrice(blob)).toBe(75)
  })

  it('uses the cheapest group size for perGroup tours', () => {
    const blob = {
      travelerDetails: {
        pricingModel: 'perGroup',
        groupSizes: [
          { from: 1, to: 4, price: 300 },
          { from: 5, to: 10, price: 500 },
        ],
      },
      pricingSchedules: { schedules: [] },
    }
    expect(lowestAdultRetailPrice(blob)).toBe(300)
  })

  it('falls back to derived schedule prices on legacy blobs', () => {
    const blob = {
      pricingSchedules: {
        schedules: [{
          prices: [
            { ageGroup: 'Adult', retailPrice: 120 },
            { ageGroup: 'Child', retailPrice: 60 },
          ],
        }],
      },
    }
    expect(lowestAdultRetailPrice(blob)).toBe(60)
  })

  it('parses JSON-string blobs', () => {
    const blob = JSON.stringify({
      travelerDetails: { pricingModel: 'perPerson', pricingApproach: 'sameForEveryone', uniformPrice: 90 },
      pricingSchedules: { schedules: [] },
    })
    expect(lowestAdultRetailPrice(blob)).toBe(90)
  })

  it('returns null for unpriceable data', () => {
    expect(lowestAdultRetailPrice(null)).toBeNull()
    expect(lowestAdultRetailPrice('not json')).toBeNull()
    expect(lowestAdultRetailPrice({ travelerDetails: { pricingModel: 'perPerson' }, pricingSchedules: { schedules: [] } })).toBeNull()
    expect(lowestAdultRetailPrice({ travelerDetails: { pricingModel: 'perGroup', groupSizes: [] }, pricingSchedules: { schedules: [] } })).toBeNull()
  })
})

describe('lowestAdultFromTravelerPricing', () => {
  const adultWithTiers = (): TravelerPricing[] => ([
    { label: 'Adult', price: 150, tiers: [
      { from: 1, to: 4, pricePerPerson: 150 },
      { from: 5, to: 99, pricePerPerson: 110 },
    ] },
    { label: 'Child', price: 75 },
  ])

  it('returns the lowest adult tier from the mapped list', () => {
    expect(lowestAdultFromTravelerPricing(adultWithTiers())).toBe(110)
  })

  it('uses the adult base price when no tiers exist', () => {
    expect(lowestAdultFromTravelerPricing([
      { label: 'Adult', price: 100 },
      { label: 'Child', price: 60 },
    ])).toBe(100)
  })

  it('falls back to the cheapest category when no adult-like label exists', () => {
    expect(lowestAdultFromTravelerPricing([{ label: 'Child', price: 75 }])).toBe(75)
  })

  it('returns null for empty lists (per-group tours)', () => {
    expect(lowestAdultFromTravelerPricing(undefined)).toBeNull()
    expect(lowestAdultFromTravelerPricing([])).toBeNull()
  })
})
