import { describe, expect, it, vi, beforeEach } from 'vitest'
import type { ReactNode } from 'react'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import AllToursPage from './AllToursPage'
import { useAllExpeditionTours, type TourCardData } from '../hooks/useExpeditionTours'
import { useSectionTourIds } from '../hooks/useHomepageSections'

vi.mock('framer-motion', () => ({
  motion: { div: ({ children }: { children?: ReactNode }) => <div>{children}</div> },
  AnimatePresence: ({ children }: { children?: ReactNode }) => <>{children}</>,
}))

vi.mock('../components/TourCard', () => ({
  default: ({ title }: { title: string }) => <div className="tour-card">{title}</div>,
}))

vi.mock('../components/TourCardSkeleton', () => ({
  default: () => <div className="tour-card-skeleton" />,
}))

vi.mock('../components/NoToursEmptyState', () => ({
  default: () => <div data-testid="empty-state" />,
}))

vi.mock('../components/Footer', () => ({
  default: () => <footer data-testid="footer" />,
}))

vi.mock('../components/SEO', () => ({
  default: () => null,
  buildItemListSchema: () => ({}),
  buildBreadcrumbSchema: () => ({}),
}))

vi.mock('@/components/shared/OptimizedImage', () => ({
  default: ({ alt }: { alt?: string }) => <img alt={alt} />,
}))

vi.mock('../context/LocationSearchContext', () => ({
  useLocationSearch: () => ({ currentLocation: null, setLocation: vi.fn() }),
}))

vi.mock('../hooks/useExpeditionTours', () => ({
  useAllExpeditionTours: vi.fn(),
  useTourFilterOptions: () => ({ data: { destinations: [], categories: [] } }),
}))

vi.mock('../hooks/useHomepageSections', () => ({
  useSectionTourIds: vi.fn(),
  useHomepageOffers: () => ({ data: [] }),
  useAttractionTours: () => ({ data: undefined, isLoading: false }),
  useLikelySellOut: () => ({ data: [] }),
}))

vi.mock('../hooks/useTourDescriptions', () => ({
  useTourDescriptionsByIds: () => new Map(),
}))

const mockAllTours = vi.mocked(useAllExpeditionTours)
const mockSectionIds = vi.mocked(useSectionTourIds)

const tourCard = (id: string, title: string): TourCardData => ({
  id,
  title,
  category: 'Tour',
  duration: '2 hours',
  features: '',
  price: '$100',
  rating: '4.8',
  reviews: 10,
  location: 'Accra, Ghana',
  image: `https://img/${id}.jpg`,
  source: 'expedition-go',
  slug: id,
  durationMinutes: 120,
  priceValue: 100,
  ratingValue: 4.8,
})

function renderPage(initialEntry: string) {
  return render(
    <MemoryRouter initialEntries={[initialEntry]}>
      <AllToursPage />
    </MemoryRouter>,
  )
}

beforeEach(() => {
  mockAllTours.mockReset()
  mockSectionIds.mockReset()

  mockAllTours.mockReturnValue({
    data: { tours: [tourCard('t1', 'Recommended Tour'), tourCard('t2', 'Other Tour')] },
    isPending: false,
    isError: false,
    error: null,
  } as unknown as ReturnType<typeof useAllExpeditionTours>)

  // The real hook is disabled (no data) without a section; only section views
  // are filtered through the curated id list.
  mockSectionIds.mockImplementation(
    (section) =>
      ({ data: section ? ['t1'] : undefined }) as unknown as ReturnType<typeof useSectionTourIds>,
  )
})

describe('AllToursPage — Top Recommendations section', () => {
  it('shows the section as a highlighted filter chip and renders the homepage cards variant', () => {
    const { container } = renderPage('/tours?section=Top%20Recommendations')

    // The section is part of the filters: its chip renders active.
    expect(screen.getByRole('button', { name: 'Top Recommendations' })).toHaveClass('active')

    // The curated ids come from the backend cache that knows this content as
    // "Recommended" — the chip and URL keep the user-facing name.
    expect(mockSectionIds).toHaveBeenCalledWith('Recommended')

    // Cards use the shared grid in its cards layout (stacked mobile design on
    // desktop), not the standard All Tours card grid.
    expect(container.querySelector('.top-recs-grid--cards')).not.toBeNull()
    expect(container.querySelector('.all-tours-grid')).toBeNull()
    expect(screen.getByText('Recommended Tour')).toBeInTheDocument()
    // The section filter narrowed the list to the curated tour.
    expect(screen.queryByText('Other Tour')).not.toBeInTheDocument()
  })

  it('keeps the standard tour card grid (and no section chip) for plain All Tours', () => {
    const { container } = renderPage('/tours')

    expect(container.querySelector('.all-tours-grid')).not.toBeNull()
    expect(container.querySelector('.top-recs-grid--cards')).toBeNull()
    expect(screen.queryByRole('button', { name: 'Top Recommendations' })).not.toBeInTheDocument()
    expect(screen.getByText('Recommended Tour')).toBeInTheDocument()
    expect(screen.getByText('Other Tour')).toBeInTheDocument()
    expect(mockSectionIds).toHaveBeenCalledWith('')
  })
})
