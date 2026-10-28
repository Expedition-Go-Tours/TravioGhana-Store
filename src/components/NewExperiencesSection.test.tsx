import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import { render, screen } from '@testing-library/react'

import NewExperiencesSection from './NewExperiencesSection'
import type { HomepageTour } from '../hooks/useHomepageSections'
import type { TourCardData } from '../hooks/useExpeditionTours'
import { useNewestTours } from '../hooks/useExpeditionTours'

/**
 * The rail is designed for five cards per view. The API's "new" slice can be
 * shorter (currently four rows, no backfill), leaving a blank slot at the end
 * of the row; the section tops it up with the next-newest catalogue tours.
 */

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string, fallback?: string) => fallback ?? key }),
}))

vi.mock('./SectionHeading', () => ({
  default: ({ title }: { title?: string }) => <h2>{title}</h2>,
}))

vi.mock('./TourCard', () => ({
  default: ({ title }: { title?: string }) => <div className="tour-card">{title}</div>,
}))

vi.mock('./TourCardSkeleton', () => ({
  default: () => <div className="tour-card-skeleton" />,
}))

// Keep the real mapToTourCard; stub only the data hooks.
vi.mock('../hooks/useHomepageSections', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../hooks/useHomepageSections')>()
  return { ...actual, useNewExperiences: () => ({ data: undefined }) }
})

vi.mock('../hooks/useExpeditionTours', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../hooks/useExpeditionTours')>()
  return { ...actual, useNewestTours: vi.fn(() => ({ data: [] })) }
})

const newestMock = vi.mocked(useNewestTours)

function homepageTour(id: string, title: string): HomepageTour {
  return {
    id,
    title,
    slug: id,
    coverPhoto: null,
    photos: [],
    category: 'City & Walking Tours',
    city: 'Accra',
    country: 'Ghana',
    averageRating: 4.5,
    reviewCount: 10,
    totalBookings: 2,
    startingPrice: 35,
    currency: 'USD',
    durationMinutes: 360,
    difficulty: null,
    tags: [],
    supplier: null,
  }
}

const card = (id: string, title: string) => ({ id, title }) as TourCardData

beforeEach(() => {
  // jsdom has no layout engine: the arrow-tracking effect still expects RO.
  class ResizeObserverStub {
    observe() {}
    unobserve() {}
    disconnect() {}
  }
  vi.stubGlobal('ResizeObserver', ResizeObserverStub)

  newestMock.mockReset()
  newestMock.mockReturnValue({ data: [] } as unknown as ReturnType<typeof useNewestTours>)
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('NewExperiencesSection — rail top-up', () => {
  it('fills the last slot with the next-newest tour when the new slice is short', () => {
    const locals = [
      homepageTour('t1', 'Chale walking tours'),
      homepageTour('t2', 'Cape Coast Castle'),
      homepageTour('t3', 'Shai Hills Safari'),
      homepageTour('t4', 'Akosombo shrine'),
    ]
    // The newest list repeats the local rows first, then the next candidate.
    newestMock.mockReturnValue({
      data: [
        card('t1', 'Chale walking tours'),
        card('t2', 'Cape Coast Castle'),
        card('t3', 'Shai Hills Safari'),
        card('t4', 'Akosombo shrine'),
        card('t5', 'Agbogbloshie E-waste Experience'),
      ],
    } as unknown as ReturnType<typeof useNewestTours>)

    const { container } = render(<NewExperiencesSection preloaded={locals} />)

    // Five cards: the four new rows plus one filler, none duplicated.
    expect(container.querySelectorAll('.newexp-card-wrap')).toHaveLength(5)
    expect(screen.getAllByText('Chale walking tours')).toHaveLength(1)
    expect(screen.getByText('Agbogbloshie E-waste Experience')).toBeInTheDocument()
    // The top-up is only requested while the rail is short.
    expect(newestMock).toHaveBeenCalledWith(6, true)
  })

  it('does not add a filler when the new slice already fills the rail', () => {
    const locals = Array.from({ length: 5 }, (_, i) => homepageTour(`t${i}`, `New tour ${i}`))
    newestMock.mockReturnValue({
      data: [card('x1', 'Older tour')],
    } as unknown as ReturnType<typeof useNewestTours>)

    const { container } = render(<NewExperiencesSection preloaded={locals} />)

    expect(container.querySelectorAll('.newexp-card-wrap')).toHaveLength(5)
    expect(screen.queryByText('Older tour')).toBeNull()
    expect(newestMock).toHaveBeenCalledWith(6, false)
  })

  it('never mixes global tours into a city-scoped section', () => {
    newestMock.mockReturnValue({
      data: [card('x1', 'Global tour')],
    } as unknown as ReturnType<typeof useNewestTours>)

    const { container } = render(
      <NewExperiencesSection
        location="Accra"
        preloaded={[homepageTour('t1', 'Accra local one'), homepageTour('t2', 'Accra local two')]}
      />,
    )

    expect(container.querySelectorAll('.newexp-card-wrap')).toHaveLength(2)
    expect(screen.queryByText('Global tour')).toBeNull()
    expect(newestMock).toHaveBeenCalledWith(6, false)
  })

  it('still de-duplicates the API backfill against the top-up cards', () => {
    const locals = [
      homepageTour('t1', 'Local one'),
      homepageTour('t2', 'Local two'),
      homepageTour('t3', 'Local three'),
      homepageTour('t4', 'Local four'),
    ]
    newestMock.mockReturnValue({
      data: [...locals.map((t) => card(t.id, t.title)), card('t5', 'Filler tour')],
    } as unknown as ReturnType<typeof useNewestTours>)

    const { container } = render(
      <NewExperiencesSection
        preloaded={locals}
        backfill={{ label: 'More experiences', tours: [homepageTour('t5', 'Filler tour'), homepageTour('t6', 'Backfill tour')] }}
      />,
    )

    // 4 local + 1 filler + 1 backfill; the duplicated filler renders once.
    expect(container.querySelectorAll('.newexp-card-wrap')).toHaveLength(6)
    expect(screen.getAllByText('Filler tour')).toHaveLength(1)
    expect(screen.getByText('Backfill tour')).toBeInTheDocument()
  })
})
