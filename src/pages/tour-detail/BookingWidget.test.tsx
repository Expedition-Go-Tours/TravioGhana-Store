import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { TourDetailData, SpecialOfferData } from '../../hooks/useExpeditionTours'

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, options?: string | { defaultValue?: string }) => {
      if (typeof options === 'string') return options
      return options?.defaultValue ?? key
    },
  }),
}))

vi.mock('../../contexts/CurrencyContext', () => ({
  useCurrency: () => ({ currency: { code: 'USD', symbol: '$' }, convertPrice: (n: number) => n }),
}))

// Keeps the idle Book-Now transition warm-up (and its map/lottie imports) out
// of the test run — the badge only needs a plain render.
vi.mock('../../lib/perfProfile', () => ({ shouldIdlePrefetch: () => false }))

import BookingWidget from './BookingWidget'

function makeTour(overrides: Partial<TourDetailData> = {}): TourDetailData {
  return {
    id: 'tour-1',
    title: 'Cape Coast Castle, Elmina Castle & Kakum National Park Tour',
    price: 90,
    scheduleType: 'operatingHours',
    travelerPricing: [{ label: 'Adult', price: 90, minAge: null, maxAge: null }],
    ...overrides,
  } as unknown as TourDetailData
}

const liveOffer: SpecialOfferData = {
  id: 'offer-1',
  name: 'Early bird',
  offerType: 'EARLY_BIRD',
  discountType: 'PERCENTAGE',
  discountPercentage: 10,
  fixedDiscountValue: null,
  startDate: null,
  endDate: null,
  promoCode: null,
  timeSlotMode: 'ALL_DAYS',
  specificWeekdays: [],
  capacityType: 'UNLIMITED',
  maxSpots: null,
  spotsSold: null,
  minQuantity: null,
  minSpendAmount: null,
  maxRedemptionsPerCustomer: null,
  stackable: false,
  earlyBirdAdvanceDays: null,
  lastMinuteWindowHours: null,
  targets: [],
}

function renderWidget(tour: TourDetailData) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <BookingWidget tour={tour} />
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

/**
 * The "Best price" pill is a signal, so it may only render while the tour
 * actually carries a live supplier offer — the same rule as the "Special
 * Offer" tag on the tour cards (including the stale/expired offer guard).
 */
describe('BookingWidget "Best price" pill', () => {
  beforeEach(() => {
    cleanup()
  })

  it('raises the pill when the tour carries a live special offer', () => {
    renderWidget(makeTour({ specialOffers: [liveOffer] }))

    expect(screen.getByText('Best price')).toBeInTheDocument()
  })

  it('hides the pill when the only offer has expired', () => {
    renderWidget(makeTour({
      specialOffers: [{ ...liveOffer, id: 'offer-2', endDate: '2020-01-01T00:00:00.000Z' }],
    }))

    expect(screen.queryByText('Best price')).toBeNull()
  })

  it('hides the pill when the tour has no offers', () => {
    renderWidget(makeTour())

    expect(screen.queryByText('Best price')).toBeNull()
  })
})
