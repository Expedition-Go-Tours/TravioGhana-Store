import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import BookingTourCard from './BookingTourCard'
import { useCombinedTourStats } from '../../hooks/useExternalReviews'
import { DEFAULT_BOOKING_TOUR, type BookingTour } from '../../lib/bookingTour'

vi.mock('../../hooks/useExternalReviews', () => ({
  useCombinedTourStats: vi.fn(),
}))

vi.mock('../../contexts/CurrencyContext', () => ({
  useCurrency: () => ({ formatPrice: (value: number) => `$${value}` }),
}))

vi.mock('@/components/shared/OptimizedImage', () => ({
  default: ({ alt }: { alt?: string }) => <img alt={alt} />,
}))

const mockCombined = vi.mocked(useCombinedTourStats)

const tour: BookingTour = {
  ...DEFAULT_BOOKING_TOUR,
  id: 't1',
  slug: 'accra-city-tour',
  title: 'Accra City Tour',
  location: 'Accra, Ghana',
  provider: 'Expedition-Go Tours Ltd',
  rating: 0,
  reviews: 0,
  price: 120,
  dateISO: '2026-08-20',
  selectedDate: '2026-08-20',
}

beforeEach(() => {
  mockCombined.mockReturnValue({ rating: 0, reviewCount: 0, externalCount: 0 })
})

describe('BookingTourCard review stats', () => {
  it('shows the combined scraped review stats instead of the raw zero fields', () => {
    mockCombined.mockReturnValue({ rating: 4.8, reviewCount: 173, externalCount: 173 })
    render(<BookingTourCard tour={tour} onChangeClick={() => {}} />)

    // The scraped TripAdvisor/GetYourGuide stats are matched by the same
    // identity inputs as TourCard/detail page (supplierName ← provider).
    expect(mockCombined).toHaveBeenCalledWith({
      title: 'Accra City Tour',
      location: 'Accra, Ghana',
      supplierName: 'Expedition-Go Tours Ltd',
      rating: 0,
      reviewCount: 0,
    })
    expect(screen.getByText('4.8')).toBeInTheDocument()
    expect(screen.getByText('(173)')).toBeInTheDocument()
  })

  it('falls back to the raw tour stats when nothing combined is available', () => {
    mockCombined.mockReturnValue({ rating: 0, reviewCount: 0, externalCount: 0 })
    render(<BookingTourCard tour={{ ...tour, rating: 4.2, reviews: 12 }} onChangeClick={() => {}} />)

    expect(screen.getByText('4.2')).toBeInTheDocument()
    expect(screen.getByText('(12)')).toBeInTheDocument()
  })
})
