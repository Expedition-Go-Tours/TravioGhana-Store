import { describe, it, expect, vi, beforeEach } from 'vitest'
import { act, renderHook } from '@testing-library/react'
import { useTravelerSelection } from './useTravelerSelection'

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
})
