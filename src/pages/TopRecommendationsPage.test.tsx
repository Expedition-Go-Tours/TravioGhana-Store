import { describe, expect, it, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import TopRecommendationsPage from './TopRecommendationsPage'
import { useHomepage, useHomepageByCity } from '../hooks/useHomepageSections'
import { useTourDescriptionsByIds } from '../hooks/useTourDescriptions'
import { useLocationSearch } from '../context/LocationSearchContext'
import type { HomepageData, HomepageTour } from '../hooks/useHomepageSections'

vi.mock('../context/LocationSearchContext', () => ({
  useLocationSearch: vi.fn(),
}))

vi.mock('../hooks/useHomepageSections', () => ({
  useHomepage: vi.fn(),
  useHomepageByCity: vi.fn(),
}))

vi.mock('../hooks/useTourDescriptions', () => ({
  useTourDescriptionsByIds: vi.fn(),
}))

vi.mock('@/components/shared/OptimizedImage', () => ({
  default: ({ alt }: { alt?: string }) => <img alt={alt} />,
}))

vi.mock('../components/Footer', () => ({
  default: () => <footer data-testid="footer" />,
}))

vi.mock('../components/SEO', () => ({
  default: () => null,
  buildBreadcrumbSchema: () => ({}),
  SITE_URL: 'https://travioafrica.com',
}))

const mockHomepage = vi.mocked(useHomepage)
const mockCityHomepage = vi.mocked(useHomepageByCity)
const mockDescriptions = vi.mocked(useTourDescriptionsByIds)
const mockLocation = vi.mocked(useLocationSearch)

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

const EMPTY_PAYLOAD = {
  sellOut: [],
  topRated: [],
  trending: [],
  recommended: [],
  new: [],
  attractions: [],
  mood: [],
  destinations: [],
  offers: [],
} as unknown as HomepageData

function setHomepage(overrides: Partial<HomepageData>, isLoading = false) {
  mockHomepage.mockReturnValue({
    data: { ...EMPTY_PAYLOAD, ...overrides },
    isLoading,
  } as unknown as ReturnType<typeof useHomepage>)
}

function setDescriptions(entries: [string, string][]) {
  mockDescriptions.mockReturnValue(
    new Map(entries) as unknown as ReturnType<typeof useTourDescriptionsByIds>,
  )
}

beforeEach(() => {
  mockHomepage.mockReset()
  mockCityHomepage.mockReset()
  mockDescriptions.mockReset()
  mockLocation.mockReset()

  mockLocation.mockReturnValue({
    currentLocation: null,
    previousLocations: [],
    setLocation: vi.fn(),
    resetLocation: vi.fn(),
    hasActiveSearch: false,
  } as unknown as ReturnType<typeof useLocationSearch>)

  mockCityHomepage.mockReturnValue({
    data: undefined,
    isLoading: false,
    isError: false,
  } as unknown as ReturnType<typeof useHomepageByCity>)

  setDescriptions([])
})

describe('TopRecommendationsPage', () => {
  it('renders the same ten rows as the homepage section — deduped and capped', () => {
    const recommended = Array.from({ length: 9 }, (_, i) => tour(`r${i}`, `Recommended ${i}`))
    // One duplicate row and one momentum top-up, exactly like the section.
    const trending = [tour('r0', 'Recommended 0'), tour('t9', 'Trending Tenth')]

    setHomepage({ recommended, trending })

    render(<TopRecommendationsPage />)

    expect(
      screen.getByRole('heading', {
        level: 1,
        name: 'Our top recommendations for things to do in Ghana',
      }),
    ).toBeInTheDocument()
    expect(screen.getAllByRole('article')).toHaveLength(10)
    expect(screen.getAllByText('Recommended 0')).toHaveLength(1)
    expect(screen.getByText('Trending Tenth')).toBeInTheDocument()
    // Descriptions are requested for exactly the displayed tours.
    expect(mockDescriptions).toHaveBeenCalledWith(
      [...Array.from({ length: 9 }, (_, i) => `r${i}`), 't9'],
      true,
    )
  })

  it('renders the card text from the tour detail descriptions', () => {
    setDescriptions([['r0', 'A scenic drive from Accra to Cape Coast.']])
    setHomepage({ recommended: [tour('r0', 'Cape Coast Castle')] })

    render(<TopRecommendationsPage />)

    expect(screen.getByText('A scenic drive from Accra to Cape Coast.')).toBeInTheDocument()
    expect(screen.getByRole('article')).toBeInTheDocument()
  })

  it('shows the ten-card skeleton while the payload loads', () => {
    mockHomepage.mockReturnValue({
      data: undefined,
      isLoading: true,
    } as unknown as ReturnType<typeof useHomepage>)

    const { container } = render(<TopRecommendationsPage />)

    expect(container.querySelectorAll('.top-rec-item--skeleton')).toHaveLength(10)
    expect(screen.queryAllByRole('article')).toHaveLength(0)
  })

  it('uses the city-scoped payload while a location search is active', () => {
    mockLocation.mockReturnValue({
      currentLocation: 'Accra',
      previousLocations: [],
      setLocation: vi.fn(),
      resetLocation: vi.fn(),
      hasActiveSearch: true,
    } as unknown as ReturnType<typeof useLocationSearch>)
    setHomepage({ recommended: [tour('g1', 'Global Tour')] })
    mockCityHomepage.mockReturnValue({
      data: { ...EMPTY_PAYLOAD, recommended: [tour('c1', 'City Scoped Tour')] },
      isLoading: false,
      isError: false,
    } as unknown as ReturnType<typeof useHomepageByCity>)

    render(<TopRecommendationsPage />)

    expect(screen.getByText('City Scoped Tour')).toBeInTheDocument()
    expect(screen.queryByText('Global Tour')).not.toBeInTheDocument()
    // The global aggregate must not race the city payload.
    expect(mockHomepage).toHaveBeenCalledWith({ enabled: false })
  })

  it('falls back to the global payload when the city scoped request fails', () => {
    mockLocation.mockReturnValue({
      currentLocation: 'Accra',
      previousLocations: [],
      setLocation: vi.fn(),
      resetLocation: vi.fn(),
      hasActiveSearch: true,
    } as unknown as ReturnType<typeof useLocationSearch>)
    setHomepage({ recommended: [tour('g1', 'Global Tour')] })
    mockCityHomepage.mockReturnValue({
      data: undefined,
      isLoading: false,
      isError: true,
    } as unknown as ReturnType<typeof useHomepageByCity>)

    render(<TopRecommendationsPage />)

    expect(screen.getByText('Global Tour')).toBeInTheDocument()
  })
})
