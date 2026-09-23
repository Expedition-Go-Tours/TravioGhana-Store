import { describe, it, expect } from 'vitest'
import { lowestAdultRetailPrice, lowestAdultFromTravelerPricing, headlineUnitPrice, cardParityUnitPrice } from './startingPrice'
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

describe('headlineUnitPrice', () => {
  const tieredAdult = (): TravelerPricing => ({
    label: 'Adult',
    price: 70,
    tiers: [
      { from: 2, to: 4, pricePerPerson: 60 },
      { from: 5, to: 99, pricePerPerson: 55 },
    ],
  })

  it('quotes the active adult tier for the current headcount', () => {
    expect(headlineUnitPrice({
      isPerGroup: false,
      adultGroup: tieredAdult(),
      totalTravelers: 3,
      travelerGroups: [tieredAdult(), { label: 'Child', price: 30 }],
    })).toBe(60)
    expect(headlineUnitPrice({
      isPerGroup: false,
      adultGroup: tieredAdult(),
      totalTravelers: 5,
      travelerGroups: [tieredAdult(), { label: 'Child', price: 30 }],
    })).toBe(55)
  })

  it('uses the flat adult price when no tier matches the headcount', () => {
    expect(headlineUnitPrice({
      isPerGroup: false,
      adultGroup: { label: 'Adult', price: 70 },
      totalTravelers: 2,
      travelerGroups: [{ label: 'Adult', price: 70 }],
    })).toBe(70)
  })

  it('falls back to the lowest adult rate then the tour price without an adult category', () => {
    expect(headlineUnitPrice({
      isPerGroup: false,
      adultGroup: null,
      totalTravelers: 2,
      travelerGroups: [{ label: 'Child', price: 40 }],
      tourPrice: 90,
    })).toBe(40)
    expect(headlineUnitPrice({
      isPerGroup: false,
      adultGroup: null,
      totalTravelers: 2,
      travelerGroups: [],
      tourPrice: 90,
    })).toBe(90)
  })

  it('quotes the band matching the selected headcount on per-group tours', () => {
    const bands = [
      { from: 1, to: 4, price: 300 },
      { from: 5, to: 10, price: 500 },
    ]
    expect(headlineUnitPrice({
      isPerGroup: true,
      matchingGroupBand: bands[1],
      lowestGroupBand: bands[0],
      totalTravelers: 6,
    })).toBe(500)
  })

  it('falls back to the cheapest band when no band matches the headcount', () => {
    expect(headlineUnitPrice({
      isPerGroup: true,
      matchingGroupBand: null,
      lowestGroupBand: { price: 300 },
      totalTravelers: 11,
    })).toBe(300)
  })
})

describe('cardParityUnitPrice', () => {
  it('returns the lowest adult tier — exactly what the tour card quotes', () => {
    expect(cardParityUnitPrice({
      isPerGroup: false,
      travelerGroups: [
        { label: 'Adult', price: 70, tiers: [
          { from: 2, to: 4, pricePerPerson: 60 },
          { from: 5, to: 99, pricePerPerson: 55 },
        ] },
        { label: 'Child', price: 30 },
      ],
    })).toBe(55)
  })

  it('returns the cheapest group band on per-group tours', () => {
    expect(cardParityUnitPrice({
      isPerGroup: true,
      lowestGroupBand: { price: 300 },
    })).toBe(300)
  })

  it('falls back to the tour price when nothing is priceable', () => {
    expect(cardParityUnitPrice({
      isPerGroup: false,
      travelerGroups: [],
      tourPrice: 90,
    })).toBe(90)
    expect(cardParityUnitPrice({
      isPerGroup: true,
      lowestGroupBand: null,
      tourPrice: 90,
    })).toBe(0)
  })
})
