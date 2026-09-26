import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import RelatedTours from './RelatedTours'
import type { TourCardData } from '../../hooks/useExpeditionTours'

/**
 * The row tops out at ten cards (five per desktop view) and always offers a way
 * out to the full catalogue from the header.
 */

vi.mock('../../components/TourCard', () => ({
  default: ({ title }: { title?: string }) => <div data-testid="tour-card">{title}</div>,
}))

const tour = (id: string, title: string): TourCardData => ({
  id,
  title,
  category: 'Tour',
  duration: '1 day',
  features: '',
  price: '$100',
  rating: '4.8',
  reviews: 10,
  location: 'Accra, Ghana',
  image: 'https://example.com/a.jpg',
  source: 'expedition-go',
  slug: id,
})

describe('RelatedTours', () => {
  it('renders the tour cards and a View All link to the full catalogue', () => {
    render(
      <MemoryRouter>
        <RelatedTours tours={[tour('a', 'Alpha Tour'), tour('b', 'Beta Tour')]} />
      </MemoryRouter>,
    )

    expect(screen.getByRole('link', { name: /view all/i })).toHaveAttribute('href', '/tours')
    expect(screen.getAllByTestId('tour-card')).toHaveLength(2)
    expect(screen.getByText('Similar Experiences')).toBeInTheDocument()
  })

  it('renders nothing without tours', () => {
    const { container } = render(
      <MemoryRouter>
        <RelatedTours tours={[]} />
      </MemoryRouter>,
    )

    expect(container).toBeEmptyDOMElement()
  })
})
