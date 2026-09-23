import { describe, it, expect, vi, beforeEach } from 'vitest'
import { act, renderHook } from '@testing-library/react'
import {
  useTravelerSelection,
  type TravelerSelectionTour,
  type TravelerSelectionOptions,
} from './useTravelerSelection'

vi.mock('../contexts/CurrencyContext', () => ({
  useCurrency: () => ({
    currency: { code: 'USD', symbol: '$', locale: 'en-US', decimals: 2, label: 'US Dollar' },
    convertPrice: (n: number) => n,
    formatPrice: (n: number) => `$${n}`,
    loading: false,
  }),
}))

const perPersonTour = {
  pricingModel: 'perPerson' as const,
  travelerPricing: [
    { label: 'Child', price: 200, minAge: 0, maxAge: 17 },
    { label: 'Adult', price: 300, minAge: 18, maxAge: 59 },
    { label: 'Senior', price: 350, minAge: 60, maxAge: 99 },
  ],
  minParticipants: 3,
  maxParticipants: 10,
  price: 300,
}

const perGroupTour = {
  pricingModel: 'perGroup' as const,
  groupSizePricing: [
    { from: 1, to: 2, price: 100 },
    { from: 3, to: 50, price: 250 },
  ],
  minParticipants: 3,
  maxParticipants: 10,
}

describe('useTravelerSelection', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('seeds at least the supplier minimum party size so the picker never starts invalid', () => {
    const { result } = renderHook(() => useTravelerSelection(perPersonTour))
    expect(result.current.categoryCounts.adult).toBe(3)
    expect(result.current.totalTravelers).toBe(3)
    expect(result.current.mixIssues).toEqual([])
  })

  it('keeps supplied initialCounts when pricing arrives late (async tour fetch)', () => {
    const noPricing: TravelerSelectionTour = {
      pricingModel: 'perPerson',
      travelerPricing: [],
      minParticipants: 3,
      maxParticipants: 10,
      price: 300,
    }
    const opts: TravelerSelectionOptions = { initialCounts: { adult: 2 } }
    const { result, rerender } = renderHook(
      (props: { tour: TravelerSelectionTour; options: TravelerSelectionOptions }) => useTravelerSelection(props.tour, props.options),
      { initialProps: { tour: noPricing, options: opts } }
    )
    // Seeded from the booking before the pricing model has loaded.
    expect(result.current.totalTravelers).toBe(2)

    // Pricing categories arrive — the supplied mix must NOT be replaced by the
    // default 2+ adult seed (this is what lets the edit page restore a booking).
    rerender({ tour: perPersonTour, options: opts })
    expect(result.current.categoryCounts.adult).toBe(2)
    expect(result.current.categoryCounts.child).toBeUndefined()
    expect(result.current.totalTravelers).toBe(2)
  })

  it('blocks decrement below the supplier minimum, across categories', () => {
    const { result } = renderHook(() => useTravelerSelection(perPersonTour))
    // 3 adults seeded; a child can be added…
    act(() => result.current.increment('child'))
    expect(result.current.totalTravelers).toBe(4)
    // …removing the child back down to the 3-person minimum works…
    act(() => result.current.decrement('child'))
    expect(result.current.totalTravelers).toBe(3)
    // …but going below the minimum is blocked for every category.
    act(() => result.current.decrement('adult'))
    expect(result.current.totalTravelers).toBe(3)
    expect(result.current.canDecrementCount('adult')).toBe(false)
  })

  it('blocks increment beyond the supplier maximum', () => {
    const { result } = renderHook(() => useTravelerSelection(perPersonTour))
    for (let i = 0; i < 7; i += 1) {
      act(() => result.current.increment('adult'))
    }
    expect(result.current.totalTravelers).toBe(10)
    expect(result.current.canIncrementCount('adult')).toBe(false)
    act(() => result.current.increment('adult'))
    expect(result.current.totalTravelers).toBe(10)
  })

  it('keeps the 2-adult default when the supplier minimum is 1 (The Nature Escape)', () => {
    const tour = { ...perPersonTour, minParticipants: 1 }
    const { result } = renderHook(() => useTravelerSelection(tour))
    expect(result.current.categoryCounts.adult).toBe(2)
    expect(result.current.totalTravelers).toBe(2)
    act(() => result.current.decrement('adult'))
    expect(result.current.totalTravelers).toBe(1)
    expect(result.current.canDecrementCount('adult')).toBe(false)
    act(() => result.current.decrement('adult'))
    expect(result.current.totalTravelers).toBe(1)
  })

  it('per-group: seeds to the minimum, caps increment at the supplier maximum', () => {
    const { result } = renderHook(() => useTravelerSelection(perGroupTour))
    expect(result.current.bookableBounds).toEqual({ min: 3, max: 10 })
    expect(result.current.groupHeadcount).toBe(3)
    expect(result.current.canDecrementCount('travelers')).toBe(false)
    for (let i = 0; i < 7; i += 1) {
      act(() => result.current.increment('travelers'))
    }
    expect(result.current.groupHeadcount).toBe(10)
    expect(result.current.canIncrementCount('travelers')).toBe(false)
    act(() => result.current.increment('travelers'))
    expect(result.current.groupHeadcount).toBe(10)
  })

  it('per-group: hides the "Group of ..." row text for a single traveler, shows it for 2+', () => {
    const tour = {
      pricingModel: 'perGroup' as const,
      groupSizePricing: [
        { from: 1, to: 1, price: 100 },
        { from: 2, to: 50, price: 250 },
      ],
      minParticipants: 1,
      maxParticipants: 50,
    }
    const { result } = renderHook(() => useTravelerSelection(tour))
    expect(result.current.groupHeadcount).toBe(2)
    act(() => result.current.decrement('travelers'))
    expect(result.current.totalTravelers).toBe(1)
    expect(result.current.travelerOptions[0].age).toBe('')
    act(() => result.current.increment('travelers'))
    expect(result.current.totalTravelers).toBe(2)
    expect(result.current.travelerOptions[0].age).toBe('2-50')
  })

  it('per-person tiered: no "· Group of ..." tier note when a single traveler is booked', () => {
    const tour = {
      pricingModel: 'perPerson' as const,
      travelerPricing: [
        {
          label: 'Adult',
          price: 300,
          minAge: 18,
          maxAge: 59,
          tiers: [
            { from: 1, to: 1, pricePerPerson: 400 },
            { from: 2, to: 4, pricePerPerson: 300 },
            { from: 5, to: 50, pricePerPerson: 250 },
          ],
        },
      ],
      minParticipants: 1,
      maxParticipants: 50,
      price: 300,
    }
    const { result } = renderHook(() => useTravelerSelection(tour))
    expect(result.current.totalTravelers).toBe(2)
    act(() => result.current.decrement('adult'))
    expect(result.current.totalTravelers).toBe(1)
    expect(result.current.travelerOptions[0].age).toBe('18-59 years')
    act(() => result.current.increment('adult'))
    expect(result.current.totalTravelers).toBe(2)
    expect(result.current.travelerOptions[0].age).toBe('18-59 years · Group of 2-4')
  })
})
