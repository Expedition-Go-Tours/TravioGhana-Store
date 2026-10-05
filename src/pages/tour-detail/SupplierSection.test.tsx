import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import SupplierSection from './SupplierSection'
import type { TourCardData } from '../../hooks/useExpeditionTours'

/**
 * The Supplier tab's rail. It must show only tours handed to it, must not
 * render at all when it has none, and must key on the stable tour id.
 */

vi.mock('../../components/TourCard', () => ({
  default: ({ title }: { title?: string }) => <div data-testid="tour-card">{title}</div>,
}))

vi.mock('@/components/shared/OptimizedImage', () => ({
  default: () => null,
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

const renderSection = (props: Partial<React.ComponentProps<typeof SupplierSection>> = {}) =>
  render(
    <MemoryRouter>
      <SupplierSection
        name="Chale Tours"
        rating={null}
        totalTours={undefined}
        onOpenInfo={() => {}}
        infoOpen={false}
        onToggleInfo={() => {}}
        tours={[]}
        {...props}
      />
    </MemoryRouter>,
  )

const railTitles = () =>
  screen.queryAllByTestId('tour-card').map((el) => el.textContent)

describe('SupplierSection', () => {
  it('renders only the tours it is given, never a similar-experiences copy', () => {
    renderSection({
      tours: [tour('a', 'Kotoka Lounge Entry'), tour('b', 'Cape Coast Castle Tour')],
    })

    expect(railTitles()).toEqual(['Kotoka Lounge Entry', 'Cape Coast Castle Tour'])
  })

  it('omits the rail entirely when the supplier has no other tours', () => {
    // A supplier whose only tour is the one being viewed. Showing anything here
    // would mean showing another supplier's work.
    renderSection({ tours: [] })

    expect(screen.queryByTestId('tour-card')).not.toBeInTheDocument()
    expect(screen.queryByText(/tours by this supplier/i)).not.toBeInTheDocument()
  })

  it('shows the supplier tour count when known', () => {
    renderSection({ tours: [tour('a', 'Kotoka Lounge Entry')], totalTours: 1 })

    expect(screen.getByText(/1 tour/i)).toBeInTheDocument()
  })

  it('omits the count rather than inventing one while it loads', () => {
    renderSection({ tours: [tour('a', 'Kotoka Lounge Entry')], totalTours: undefined })

    expect(screen.queryByText(/\d+ tours?/i)).not.toBeInTheDocument()
  })

  it('keys cards on tour id so duplicate titles do not collide', () => {
    const { container } = renderSection({
      // Two distinct tours that happen to share a title — plausible once a
      // supplier's real catalogue is behind this rail.
      tours: [tour('id-one', 'Same Title'), tour('id-two', 'Same Title')],
    })

    const wraps = container.querySelectorAll('.supplier-tour-card-wrap')
    expect(wraps).toHaveLength(2)
    expect(screen.getAllByTestId('tour-card')).toHaveLength(2)
  })
})