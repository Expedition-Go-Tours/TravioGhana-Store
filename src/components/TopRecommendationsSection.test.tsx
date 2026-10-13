import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
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

// Full description paragraphs from the tour-detail endpoint (>300 chars).
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

  it('links "View All" to the All Tours Top Recommendations filter view', () => {
    renderSection({ preloaded: [tour('abc', 'Cape Coast Castle')] })

    expect(screen.getByRole('link', { name: 'View All' })).toHaveAttribute(
      'href',
      '/tours?section=Top Recommendations',
    )
  })

  it('opens the title and the image to the tour detail page in a new tab', () => {
    const { container } = renderSection({ preloaded: [tour('abc', 'Cape Coast Castle')] })

    // Both the cover image and the title link to the same canonical tour page
    // and open it in a new tab (mirrors expeditiongotours.com), so the
    // homepage keeps its scroll position behind the new tab. Scoped to the
    // card: the heading's "View All" is a link too.
    const links = within(screen.getByRole('article')).getAllByRole('link')
    expect(links).toHaveLength(2)
    for (const link of links) {
      expect(link).toHaveAttribute('href', '/tour/abc/abc')
      expect(link).toHaveAttribute('target', '_blank')
      expect(link).toHaveAttribute('rel', 'noopener')
    }
    const imageLink = container.querySelector('a.top-rec-image')
    expect(imageLink).toHaveAttribute('href', '/tour/abc/abc')
    expect(imageLink).toHaveAttribute('target', '_blank')
    expect(imageLink).toHaveAttribute('aria-label', 'Cape Coast Castle')
  })

  it('renders the full-description excerpt from the detail data', () => {
    setDescriptions([
      ['r0', 'A scenic drive from Accra to Cape Coast.'],
      ['r1', ''],
    ])

    renderSection({
      preloaded: [tour('r0', 'Cape Coast Castle'), tour('r1', 'No Description')],
    })

    expect(screen.getByText('A scenic drive from Accra to Cape Coast.')).toBeInTheDocument()
    // The row without a description still renders, just without an excerpt.
    expect(screen.getAllByRole('article')).toHaveLength(2)
    expect(document.querySelectorAll('.top-rec-excerpt')).toHaveLength(1)
    // Descriptions are requested for exactly the displayed tours.
    expect(mockDescriptions).toHaveBeenCalledWith(['r0', 'r1'], true)
  })

  it('expands the full description in place via See more / See less', () => {
    setDescriptions([['r0', `${PARA_ONE}\n${PARA_TWO}`]])

    renderSection({ preloaded: [tour('r0', 'Waterfalls Day Tour')] })
    const card = screen.getByRole('article')

    // Collapsed: clamped single block, second paragraph not its own element.
    expect(screen.getByRole('button', { name: 'See more' })).toBeInTheDocument()
    expect(screen.queryByText(PARA_TWO, { exact: true })).not.toBeInTheDocument()
    expect(card).not.toHaveClass('top-rec-item--expanded')

    fireEvent.click(screen.getByRole('button', { name: 'See more' }))

    // Expanded: the card takes its full row width (wide text column).
    expect(card).toHaveClass('top-rec-item--expanded')
    expect(screen.getByRole('button', { name: 'See less' })).toHaveAttribute('aria-expanded', 'true')
    expect(screen.getByText(PARA_ONE, { exact: true })).toBeInTheDocument()
    expect(screen.getByText(PARA_TWO, { exact: true })).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'See less' }))

    expect(card).not.toHaveClass('top-rec-item--expanded')
    expect(screen.getByRole('button', { name: 'See more' })).toHaveAttribute('aria-expanded', 'false')
    expect(screen.queryByText(PARA_TWO, { exact: true })).not.toBeInTheDocument()
  })

  it('hides the toggle when the description is short', () => {
    setDescriptions([['r0', 'A short blurb that fits without clamping.']])

    renderSection({ preloaded: [tour('r0', 'Short Tour')] })

    expect(screen.getByText('A short blurb that fits without clamping.')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'See more' })).not.toBeInTheDocument()
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

/**
 * Touch layouts (≤1023px): the "See more" toggle is hidden, so the clamped
 * description itself becomes the affordance and opens the whole text in a
 * dialog. jsdom has no matchMedia — mock it to the compact branch (the same
 * approach TourCard/Wishlist tests use).
 */
describe('TopRecommendationsSection — tap-to-read on touch layouts', () => {
  const originalMatchMedia = window.matchMedia

  beforeEach(() => {
    window.matchMedia = ((query: string) => ({
      matches: query.includes('1023'),
      media: query,
      onchange: null,
      addEventListener: () => {},
      removeEventListener: () => {},
      addListener: () => {},
      removeListener: () => {},
      dispatchEvent: () => false,
    })) as unknown as typeof window.matchMedia
  })

  afterEach(() => {
    window.matchMedia = originalMatchMedia
  })

  it('opens the whole description in a dialog when the clamped text is tapped', () => {
    setDescriptions([['r0', `${PARA_ONE}\n${PARA_TWO}`]])
    renderSection({ preloaded: [tour('r0', 'Waterfalls Day Tour')] })

    // Compact: the text itself is the affordance — no See more toggle.
    expect(screen.queryByRole('button', { name: 'See more' })).not.toBeInTheDocument()
    const textButton = screen.getByRole('button', { name: new RegExp(PARA_ONE.slice(0, 30)) })

    fireEvent.click(textButton)

    const dialog = screen.getByRole('dialog')
    expect(dialog).toHaveAttribute('aria-modal', 'true')
    expect(within(dialog).getByText(PARA_ONE, { exact: true })).toBeInTheDocument()
    expect(within(dialog).getByText(PARA_TWO, { exact: true })).toBeInTheDocument()

    // Escape closes it.
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()

    // Re-open and close via the ✕ button.
    fireEvent.click(textButton)
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Close' }))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('keeps short descriptions as plain, inert text', () => {
    setDescriptions([['r0', 'A short blurb that fits without clamping.']])
    renderSection({ preloaded: [tour('r0', 'Short Tour')] })

    expect(screen.getByText('A short blurb that fits without clamping.')).toBeInTheDocument()
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(screen.queryByRole('button')).not.toBeInTheDocument()
  })
})

/**
 * The All Tours section view renders the grid in its "cards" layout: there,
 * "See more" opens the description dialog even on desktop (mirroring
 * expeditiongotours.com) — the card never inline-expands.
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
