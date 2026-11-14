import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    // i18next signature: t(key, defaultValue?, options?). The operator line
    // passes the interpolation values as the third argument.
    t: (key: string, second?: unknown, third?: Record<string, unknown>) => {
      const fallback = typeof second === 'string' ? second : undefined
      const options =
        second && typeof second === 'object'
          ? (second as Record<string, unknown>)
          : third
      const value =
        ({
          'sections.whatTravellersAreSaying': 'What Travellers are Saying',
          'reviews.writeAReview': 'Write a review',
          'reviews.basedOn': 'based on {{count}} reviews',
          'reviews.noReviewsTitle': 'No reviews yet',
          'reviews.noReviewsText':
            'This experience is new on TravioGhana. Reviews appear here as soon as travellers write them.',
          'reviews.readThem': 'Read them',
          'tourDetail.destinationHost': 'Experience Host',
          'tourDetail.operatorReviews': '{{count}} reviews on TripAdvisor, GetYourGuide & Google',
        } as Record<string, string>)[key] ?? fallback ?? key
      if (!options) return value
      return value.replace(/\{\{(\w+)\}\}/g, (_, name: string) => String(options[name] ?? ''))
    },
  }),
}))

vi.mock('@/components/shared/OptimizedImage', () => ({
  default: () => null,
}))

import ReviewsSection from './ReviewsSection'

const emptyBreakdown = [5, 4, 3, 2, 1].map((stars) => ({
  label: `${stars} stars`,
  stars,
  count: 0,
  percentage: 0,
}))

function renderSection(overrides: Partial<Parameters<typeof ReviewsSection>[0]> = {}) {
  return render(
    <ReviewsSection
      rating={0}
      reviewCount={0}
      reviewBreakdown={emptyBreakdown}
      reviews={[]}
      hasMore={false}
      loadingMore={false}
      onLoadMore={() => {}}
      onWriteReview={() => {}}
      starFilter={null}
      onStarFilterChange={() => {}}
      {...overrides}
    />,
  )
}

/**
 * The Reviews tab used to print "0.0 — based on 0 reviews" for the 27 tours
 * with no listing of their own, which reads as a bad score. It now says the
 * listing is new and attributes the host's marketplace totals instead.
 */
describe('ReviewsSection zero state', () => {
  beforeEach(() => {
    cleanup()
  })

  it('never renders "0.0" or "based on 0 reviews"', () => {
    renderSection()

    expect(screen.queryByText('0.0')).toBeNull()
    expect(screen.queryByText('based on 0 reviews')).toBeNull()
    expect(screen.getByText('No reviews yet')).toBeInTheDocument()
  })

  it("shows the host's totals, attributed to the host", () => {
    renderSection({
      supplierName: 'Expedition-Go Tours LTD',
      operatorProof: { rating: 4.9, reviewCount: 1204 },
    })

    expect(
      screen.getByText('Expedition-Go Tours LTD · 4.9 · 1204 reviews on TripAdvisor, GetYourGuide & Google'),
    ).toBeInTheDocument()
  })

  it('offers a link to the host reviews when a handler is given', () => {
    const onOperatorReviewsClick = vi.fn()
    renderSection({
      supplierName: 'Expedition-Go Tours LTD',
      operatorProof: { rating: 4.9, reviewCount: 1204 },
      onOperatorReviewsClick,
    })

    fireEvent.click(screen.getByRole('button', { name: 'Read them' }))
    expect(onOperatorReviewsClick).toHaveBeenCalledTimes(1)
  })

  it('shows no host proof when the tour has its own reviews', () => {
    renderSection({
      rating: 4.3,
      reviewCount: 9,
      reviewBreakdown: emptyBreakdown.map((row) => ({
        ...row,
        count: row.stars === 4 ? 9 : 0,
        percentage: row.stars === 4 ? 100 : 0,
      })),
      reviews: [
        { id: 'r1', name: 'Ama', date: '2026-10-01', rating: 4, text: 'Great day out.' },
      ],
      supplierName: 'Expedition-Go Tours LTD',
      operatorProof: { rating: 4.9, reviewCount: 1204 },
    })

    expect(screen.getByText('4.3')).toBeInTheDocument()
    expect(screen.getByText('based on 9 reviews')).toBeInTheDocument()
    expect(screen.queryByText('No reviews yet')).toBeNull()
    expect(screen.queryByText(/on TripAdvisor, GetYourGuide & Google/)).toBeNull()
  })
})
