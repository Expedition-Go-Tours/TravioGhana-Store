import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'

import TopRatedSection from './TopRatedSection'
import type { HomepageTour } from '../hooks/useHomepageSections'

/**
 * Location-scoped section rendering.
 *
 * The API returns local rows in `tours` and pads the row with a labelled rail
 * (`backfill`). The storefront used to append that rail on top of a `tours`
 * array that already contained it, so every filler card rendered twice — and a
 * region with no local supply rendered nothing but filler under a regional
 * title. These tests pin both behaviours.
 */

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string, fallback?: string) => fallback ?? key }),
}))

vi.mock('./SectionHeading', () => ({
  default: ({ title }: { title?: string }) => <h2>{title}</h2>,
}))

vi.mock('./TourCard', () => ({
  default: ({ title }: { title?: string }) => <div>{title}</div>,
}))

// Keep the real mapToTourCard; only the fallback hook is stubbed (a scoped
// section must not fetch the global list).
vi.mock('../hooks/useHomepageSections', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../hooks/useHomepageSections')>()
  return { ...actual, useTopRated: () => ({ data: undefined }) }
})

function tour(id: string, title: string): HomepageTour {
  return {
    id,
    title,
    slug: id,
    coverPhoto: null,
    photos: [],
    category: 'City & Walking Tours',
    city: 'Bonwire',
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

describe('TopRatedSection — location rail', () => {
  it('renders local rows once, then the labelled rail without duplicates', () => {
    render(
      <TopRatedSection
        location="Ashanti"
        title="Top Rated in Ashanti Region"
        preloaded={[tour('t1', 'Kumasi Heritage Day'), tour('t2', 'Accra City Tour')]}
        backfill={{
          label: 'More experiences near Ashanti',
          // t2 is deliberately in both, mirroring the API's overlap.
          tours: [tour('t2', 'Accra City Tour'), tour('t3', 'Cape Coast Castles')],
        }}
      />
    )

    expect(screen.getByText('Top Rated in Ashanti Region')).toBeInTheDocument()
    expect(screen.getByText('More experiences near Ashanti')).toBeInTheDocument()
    // The duplicated tour renders exactly once.
    expect(screen.getAllByText('Accra City Tour')).toHaveLength(1)
    expect(screen.getAllByText('Kumasi Heritage Day')).toHaveLength(1)
    expect(screen.getAllByText('Cape Coast Castles')).toHaveLength(1)
  })

  it('renders the rail alone (no dangling divider) when the region has no local tours', () => {
    render(
      <TopRatedSection
        location="Ashanti"
        title="Top Rated in Ashanti Region"
        preloaded={[]}
        backfill={{ label: 'More experiences near Ashanti', tours: [tour('t3', 'Cape Coast Castles')] }}
      />
    )

    // Nothing local precedes the rail, so there is nothing to divide from.
    expect(screen.queryByText('More experiences near Ashanti')).toBeNull()
    expect(screen.getByText('Cape Coast Castles')).toBeInTheDocument()
  })

  it('hides the rail entirely once local supply fills the row', () => {
    render(
      <TopRatedSection
        location="Accra"
        title="Top Rated in Accra Region"
        preloaded={[tour('t1', 'Accra City Tour')]}
        backfill={null}
      />
    )

    expect(screen.getByText('Accra City Tour')).toBeInTheDocument()
    expect(screen.queryByText(/More experiences/)).toBeNull()
  })
})
