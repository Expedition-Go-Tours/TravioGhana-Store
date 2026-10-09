import { describe, expect, it, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import TopRecommendationsSection from './TopRecommendationsSection'
import { useTourDescriptions, type TourCatalogItem } from '../hooks/useTourDescriptions'
import type { HomepageTour } from '../hooks/useHomepageSections'

vi.mock('../hooks/useTourDescriptions', () => ({
  useTourDescriptions: vi.fn(),
}))

vi.mock('@/components/shared/OptimizedImage', () => ({
  default: ({ alt }: { alt?: string }) => <img alt={alt} />,
}))

const mockCatalog = vi.mocked(useTourDescriptions)

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

const catalogRow = (id: string, description = ''): TourCatalogItem => ({
  id,
  title: `Catalog ${id}`,
  slug: id,
  image: `https://img/${id}.jpg`,
  description,
})

// Long enough to pass the detail page's 300-char long-description gate.
const PARA_ONE =
  "Escape the city and discover the natural beauty, culture and hidden gems of Ghana's Eastern Region on this unforgettable full-day tour from Accra."
const PARA_TWO =
  "Your journey begins with a scenic drive into the beautiful Akuapem Mountains, where you will enjoy breathtaking views, refreshing mountain air and the peaceful charm of Ghana's countryside."

function setCatalog(rows: TourCatalogItem[]) {
  mockCatalog.mockReturnValue({ data: rows } as unknown as ReturnType<typeof useTourDescriptions>)
}

function renderSection(props: Parameters<typeof TopRecommendationsSection>[0]) {
  return render(
    <MemoryRouter>
      <TopRecommendationsSection {...props} />
    </MemoryRouter>,
  )
}

beforeEach(() => {
  mockCatalog.mockReset()
  setCatalog([])
})

describe('TopRecommendationsSection', () => {
  it('renders ten unique rows — recommended first, topped up from trending', () => {
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

  it('routes only the title to the tour detail page', () => {
    renderSection({ preloaded: [tour('abc', 'Cape Coast Castle')] })

    expect(screen.getByRole('link', { name: 'Cape Coast Castle' })).toHaveAttribute(
      'href',
      '/tour/abc/abc',
    )
    // Image, excerpt and toggle are not links — the title is the only route in.
    expect(screen.getAllByRole('link')).toHaveLength(1)
  })

  it('joins description excerpts by id from the catalogue', () => {
    setCatalog([catalogRow('r0', 'A scenic drive from Accra to Cape Coast.')])

    renderSection({
      preloaded: [tour('r0', 'Cape Coast Castle'), tour('r1', 'No Description')],
    })

    expect(screen.getByText('A scenic drive from Accra to Cape Coast.')).toBeInTheDocument()
    // The row without a catalogue description still renders, just without an excerpt.
    expect(screen.getAllByRole('article')).toHaveLength(2)
    expect(document.querySelectorAll('.top-rec-excerpt')).toHaveLength(1)
  })

  it('expands the full description in place via See more / See less', () => {
    setCatalog([catalogRow('r0', `${PARA_ONE}\n${PARA_TWO}`)])

    renderSection({ preloaded: [tour('r0', 'Waterfalls Day Tour')] })

    // Collapsed: clamped single block, second paragraph not its own element.
    expect(screen.getByRole('button', { name: 'See more' })).toBeInTheDocument()
    expect(screen.queryByText(PARA_TWO, { exact: true })).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'See more' }))

    expect(screen.getByRole('button', { name: 'See less' })).toHaveAttribute('aria-expanded', 'true')
    expect(screen.getByText(PARA_ONE, { exact: true })).toBeInTheDocument()
    expect(screen.getByText(PARA_TWO, { exact: true })).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'See less' }))

    expect(screen.getByRole('button', { name: 'See more' })).toHaveAttribute('aria-expanded', 'false')
    expect(screen.queryByText(PARA_TWO, { exact: true })).not.toBeInTheDocument()
  })

  it('hides the toggle when the description is short', () => {
    setCatalog([catalogRow('r0', 'A short blurb that fits without clamping.')])

    renderSection({ preloaded: [tour('r0', 'Short Tour')] })

    expect(screen.getByText('A short blurb that fits without clamping.')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'See more' })).not.toBeInTheDocument()
  })

  it('fills up to ten rows from the catalogue when the payload is short', () => {
    setCatalog(Array.from({ length: 12 }, (_, i) => catalogRow(`c${i}`)))

    renderSection({ preloaded: [tour('r0', 'Recommended 0')] })

    expect(screen.getAllByRole('article')).toHaveLength(10)
    expect(screen.getByText('Catalog c0')).toBeInTheDocument()
    expect(screen.queryByText('Catalog c9')).not.toBeInTheDocument()
  })

  it('renders nothing without rows and without loading', () => {
    const { container } = renderSection({})
    expect(container).toBeEmptyDOMElement()
  })

  it('shows the ten-row skeleton while loading', () => {
    const { container } = renderSection({ isLoading: true })
    expect(container.querySelectorAll('.top-rec-item--skeleton')).toHaveLength(10)
  })
})
