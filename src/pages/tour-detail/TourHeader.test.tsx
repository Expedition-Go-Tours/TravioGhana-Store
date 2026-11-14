import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    // i18next signature: t(key, defaultValue?, options?). The header passes
    // the interpolation values as the third argument.
    t: (key: string, second?: unknown, third?: Record<string, unknown>) => {
      const fallback = typeof second === 'string' ? second : undefined
      const options =
        second && typeof second === 'object'
          ? (second as Record<string, unknown>)
          : third
      const value =
        ({
          'sections.reviews': 'Reviews',
          'tourDetail.destination': 'Destination',
          'tourDetail.destinationHost': 'Experience Host',
          'tourDetail.defaultLocation': 'Ghana',
          'tourDetail.newListing': 'New',
          'tourDetail.operatorReviews': '{{count}} reviews on TripAdvisor, GetYourGuide & Google',
        } as Record<string, string>)[key] ?? fallback ?? key
      if (!options) return value
      return value.replace(/\{\{(\w+)\}\}/g, (_, name: string) => String(options[name] ?? ''))
    },
  }),
}))

import TourHeader from './TourHeader'

/**
 * The three infos above the gallery are one white card: Reviews (combined
 * rating + count), Destination and Experience Host. These tests pin the
 * mockup's "4.3 (900)" value plus the count-only fallback for tours that have
 * no rating yet.
 */
describe('TourHeader info card', () => {
  beforeEach(() => {
    cleanup()
  })

  function renderHeader(overrides: Partial<Parameters<typeof TourHeader>[0]> = {}) {
    return render(
      <TourHeader
        title="Cape Coast Castle, Elmina Castle & Kakum National Park Tour"
        onReviewsClick={() => {}}
        {...{ rating: 4.3, reviewCount: 900, ...overrides }}
      />,
    )
  }

  it('shows the combined rating and count as "4.3 (900)"', () => {
    renderHeader()

    expect(screen.getByRole('button')).toHaveTextContent('4.3 (900)')
  })

  it('falls back to the plain count when the tour has no rating', () => {
    renderHeader({ rating: 0, reviewCount: 12 })

    expect(screen.getByRole('button')).toHaveTextContent('12 reviews')
  })

  it('shows the destination and the Experience Host', () => {
    renderHeader({ location: 'Cape Coast, Ghana', supplierName: 'Expedition-Go Tours LTD' })

    expect(screen.getByText('Destination')).toBeInTheDocument()
    expect(screen.getByText('Cape Coast, Ghana')).toBeInTheDocument()
    expect(screen.getByText('Experience Host')).toBeInTheDocument()
    expect(screen.getByText('Expedition-Go Tours LTD')).toBeInTheDocument()
  })

  it('drops the provider cell when no supplier is set', () => {
    renderHeader()

    expect(screen.queryByText('Experience Host')).toBeNull()
  })

  it('fires onReviewsClick from the reviews value', () => {
    const onReviewsClick = vi.fn()
    renderHeader({ onReviewsClick })

    fireEvent.click(screen.getByRole('button'))
    expect(onReviewsClick).toHaveBeenCalledTimes(1)
  })

  describe('zero-review tours', () => {
    const supplier = 'Expedition-Go Tours LTD'
    const operatorProof = { rating: 4.9, reviewCount: 1204 }

    it('says "New" instead of "0 reviews"', () => {
      renderHeader({ rating: 0, reviewCount: 0, supplierName: supplier, operatorProof })

      expect(screen.getByRole('button', { name: 'New' })).toHaveTextContent('New')
      expect(screen.queryByText(/0 reviews/)).toBeNull()
    })

    it("shows the host's marketplace totals, labelled as theirs", () => {
      renderHeader({ rating: 0, reviewCount: 0, supplierName: supplier, operatorProof })

      expect(
        screen.getByText('4.9 · 1204 reviews on TripAdvisor, GetYourGuide & Google'),
      ).toBeInTheDocument()
      expect(screen.getByText(supplier)).toBeInTheDocument()
    })

    it('never borrows the host total for a tour with its own rating', () => {
      renderHeader({ rating: 4.3, reviewCount: 900, supplierName: supplier, operatorProof })

      expect(screen.queryByText(/reviews on TripAdvisor/)).toBeNull()
    })

    it('never borrows the host total for a tour with its own count', () => {
      renderHeader({ rating: 0, reviewCount: 12, supplierName: supplier, operatorProof })

      expect(screen.queryByText(/reviews on TripAdvisor/)).toBeNull()
    })

    it('fires onOperatorReviewsClick from the host proof', () => {
      const onOperatorReviewsClick = vi.fn()
      renderHeader({
        rating: 0,
        reviewCount: 0,
        supplierName: supplier,
        operatorProof,
        onOperatorReviewsClick,
      })

      fireEvent.click(screen.getByRole('button', { name: /reviews on TripAdvisor/ }))
      expect(onOperatorReviewsClick).toHaveBeenCalledTimes(1)
    })

    it('renders the proof as plain text when nothing handles the click', () => {
      renderHeader({ rating: 0, reviewCount: 0, supplierName: supplier, operatorProof })

      expect(
        screen.queryByRole('button', { name: /reviews on TripAdvisor/ }),
      ).toBeNull()
      expect(
        screen.getByText('4.9 · 1204 reviews on TripAdvisor, GetYourGuide & Google'),
      ).toBeInTheDocument()
    })
  })
})
