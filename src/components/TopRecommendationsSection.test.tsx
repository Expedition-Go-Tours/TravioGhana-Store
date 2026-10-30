import { describe, expect, it, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import TopRecommendationsSection from './TopRecommendationsSection'
import TopRecommendationsGrid from './TopRecommendationsGrid'
import { useTourDescriptionsByIds } from '../hooks/useTourDescriptions'
import type { HomepageTour } from '../hooks/useHomepageSections'

vi.mock('../hooks/useTourDescriptions', () => ({
  useTourDescriptionsByIds: vi.fn(),
}))

vi.mock('@/components/shared/OptimizedImage', () => ({
  default: ({ alt }: { alt?: string }) => <img alt={alt} />,
}))

const mockDescriptions = vi.mocked(useTourDescriptionsByIds)

const tour = (id: string, title: string): HomepageTour => ({
  id,
  title,
  slug: id,
  coverPhoto: `https://img/${id}.jpg`,
  photos: [],
  category: 'Tour',
  city: 'Accra',
  country: 'Ghana',
  averageRating: null,
  reviewCount: 0,
  totalBookings: 0,
  startingPrice: 100,
  currency: 'USD',
  durationMinutes: 60,
  difficulty: null,
  tags: [],
  supplier: null,
})

const PARA_ONE =
  "Escape the city and discover the natural beauty, culture and hidden gems of Ghana's Eastern Region on this unforgettable full-day tour from Accra."
const PARA_TWO =
  "Your journey begins with a scenic drive into the beautiful Akuapem Mountains, where you will enjoy breathtaking views, refreshing mountain air and the peaceful charm of Ghana's countryside."

function setDescriptions(entries: [string, string][]) {
  mockDescriptions.mockReturnValue(new Map(entries) as unknown as ReturnType<typeof useTourDescriptionsByIds>)
}

function renderSection(props: Parameters<typeof TopRecommendationsSection>[0]) {
  return render(
    <MemoryRouter>
      <TopRecommendationsSection {...props} />
    </MemoryRouter>,
  )
}

beforeEach(() => {
  mockDescriptions.mockReset()
  setDescriptions([])
})

describe('TopRecommendationsSection — homepage rail', () => {
  it('renders ten unique cards — recommended first, topped up from trending', () => {
    const recommended = Array.from({ length: 9 }, (_, i) => tour(`r${i}`, `Recommended ${i}`))
    const trending = [tour('r0', 'Recommended 0'), tour('t10', 'Trending Tenth')]

    renderSection({ preloaded: recommended, trending })

    expect(screen.getAllByRole('article')).toHaveLength(10)
    expect(screen.getByText('Trending Tenth')).toBeInTheDocument()
    // The duplicate recommended row is dropped, not shown twice.
    expect(screen.getAllByText('Recommended 0')).toHaveLength(1)
    expect(
      screen.getByRole('heading', { name: 'Our top recommendations for things to do in Ghana' }),
    ).toBeInTheDocument()
  })

  it('links "View all experiences" to the All Tours Top Recommendations filter view', () => {
    renderSection({ preloaded: [tour('abc', 'Cape Coast Castle')] })

    expect(screen.getByRole('link', { name: 'View all experiences' })).toHaveAttribute(
      'href',
      '/tours?section=Top Recommendations',
    )
  })

  it('makes the whole card a link to the tour detail page', () => {
    renderSection({ preloaded: [tour('abc', 'Cape Coast Castle')] })

    const card = screen.getByRole('article')
    const links = within(card).getAllByRole('link')
    expect(links).toHaveLength(1)
    expect(links[0]).toHaveAttribute('href', '/tour/abc/abc')
    // Mirrors the rest of the homepage: the tour opens in a new tab so the
    // rail keeps its scroll position behind it.
    expect(links[0]).toHaveAttribute('target', '_blank')
    expect(links[0]).toHaveAttribute('rel', 'noopener')
    expect(screen.getByText('Check availability')).toBeInTheDocument()
  })

  it('renders the description excerpt from the detail data', () => {
    setDescriptions([['r0', 'A scenic drive from Accra to Cape Coast.']])

    renderSection({ preloaded: [tour('r0', 'Cape Coast Castle'), tour('r1', 'No Description')] })

    expect(screen.getByText('A scenic drive from Accra to Cape Coast.')).toBeInTheDocument()
    expect(screen.getAllByRole('article')).toHaveLength(2)
    expect(mockDescriptions).toHaveBeenCalledWith(['r0', 'r1'], true)
  })

  it('shows the product type as a tag on the photo', () => {
    renderSection({ preloaded: [tour('r0', 'Cape Coast Castle')] })

    expect(screen.getByText('Tour')).toBeInTheDocument()
  })

  it('renders nothing without rows and without loading', () => {
    const { container } = renderSection({})
    expect(container).toBeEmptyDOMElement()
  })

  it('shows the rail skeleton while loading', () => {
    const { container } = renderSection({ isLoading: true })
    expect(container.querySelectorAll('.top-recs-slide--skeleton')).toHaveLength(5)
  })

  it('keeps both arrows disabled when the rail does not overflow', () => {
    renderSection({ preloaded: [tour('r0', 'Cape Coast Castle')] })

    expect(screen.getByRole('button', { name: 'Previous tours' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Next tours' })).toBeDisabled()
  })
})

/**
 * The All Tours section view still renders the shared grid in its "cards"
 * layout: there, "See more" opens the description dialog even on desktop
 * (mirroring expeditiongotours.com) — the card never inline-expands.
 */
describe('TopRecommendationsGrid — cards layout', () => {
  it('opens the dialog from "See more" on desktop instead of expanding the card', () => {
    render(
      <TopRecommendationsGrid
        layout="cards"
        items={[{ id: 'r0', title: 'Waterfalls Day Tour', slug: 'r0', image: 'https://img/r0.jpg' }]}
        descriptions={new Map([['r0', `${PARA_ONE}\n${PARA_TWO}`]])}
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: 'See more' }))

    const dialog = screen.getByRole('dialog')
    expect(within(dialog).getByText(PARA_ONE, { exact: true })).toBeInTheDocument()
    expect(within(dialog).getByText(PARA_TWO, { exact: true })).toBeInTheDocument()

    // The card itself never expands in this layout and the label stays "See more".
    expect(document.querySelector('.top-rec-item--expanded')).toBeNull()
    expect(screen.queryByRole('button', { name: 'See less' })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'See more' })).toBeInTheDocument()
  })
})
