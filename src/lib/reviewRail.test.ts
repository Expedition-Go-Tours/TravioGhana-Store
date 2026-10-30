import { describe, expect, it } from 'vitest'
import {
  resolveReviewTitleMatches,
  reviewTitleKey,
  selectDistinctReviews,
  type MatchableCardTour,
} from './reviewRail'

const TOURS: MatchableCardTour[] = [
  {
    id: 'tour_cape',
    slug: 'cape-coast-castle-elmina-castle-kakum-national-park-tour',
    title: 'Cape Coast Castle, Elmina Castle & Kakum National Park Tour',
    location: 'Cape Coast, Ghana',
    category: 'tour',
    supplierName: 'Expedition-Go Tours LTD',
    image: 'https://cdn.example/cape-coast.jpg',
  },
  {
    id: 'tour_accra',
    slug: 'accra-guided-city-tour-cultural-and-historical-experience',
    title: 'Accra Guided City Tour: Cultural and Historical Experience',
    location: 'Accra, Ghana',
    category: 'tour',
    supplierName: 'Expedition-Go Tours LTD',
    photos: ['https://cdn.example/accra-1.jpg', 'https://cdn.example/accra-2.jpg'],
  },
  {
    id: 'tour_transport',
    slug: 'transport-form-accra-to-cape-coast',
    title: 'Transport form Accra to Cape Coast',
    location: 'Cape Coast, Ghana',
    category: 'transport',
    supplierName: 'Expedition-Go Tours LTD',
    image: 'https://cdn.example/transport.jpg',
  },
  {
    id: 'tour_airport',
    slug: 'private-accra-international-airport-pickup-dropoff',
    title: 'Private Accra International Airport Pickup & Dropoff',
    location: 'Accra, Ghana',
    category: 'transport',
    supplierName: 'Expedition-Go Tours LTD',
    image: 'https://cdn.example/airport.jpg',
  },
  {
    id: 'tour_north',
    slug: 'northern-safari',
    title: 'Northern Safari',
    location: 'Tamale, Ghana',
    category: 'tour',
    supplierName: 'Someone Else Ltd',
    image: 'https://cdn.example/other-operator.jpg',
  },
]

const get = (title: string) => resolveReviewTitleMatches([{ tourTitle: title }], TOURS).get(reviewTitleKey(title))

describe('resolveReviewTitleMatches', () => {
  it('links the CTA to the specific tour and uses its photo', () => {
    const match = get('Cape Coast Castle, Elmina Castle & Kakum National Park Day Tour')
    expect(match?.href).toBe('/tour/tour_cape/cape-coast-castle-elmina-castle-kakum-national-park-tour')
    expect(match?.image).toBe('https://cdn.example/cape-coast.jpg')
    expect(match?.cta).toBe('tour')
  })

  it('resolves the scraped Cape Coast day-tour wording through the alias', () => {
    const match = get('From Accra: The Cape Coast Day Tour Guided Experience')
    expect(match?.href).toContain('/tour/tour_cape/')
    expect(match?.href).not.toContain('transport')
    expect(match?.cta).toBe('tour')
  })

  it('falls back to the tour photo gallery', () => {
    const match = get('Accra Guided City Tour Experience')
    expect(match?.image).toBe('https://cdn.example/accra-1.jpg')
    expect(match?.cta).toBe('tour')
  })

  it('prefers a thumbnail the review already carries', () => {
    const map = resolveReviewTitleMatches(
      [{ tourTitle: 'Cape Coast Castle, Elmina Castle & Kakum National Park Day Tour', tourThumbnail: 'https://cdn.example/scraped.jpg' }],
      TOURS,
    )
    expect(map.get(reviewTitleKey('Cape Coast Castle, Elmina Castle & Kakum National Park Day Tour'))?.image)
      .toBe('https://cdn.example/scraped.jpg')
  })

  it('fails closed for another operator\'s tour', () => {
    const match = get('Northern Safari')
    expect(match?.href).toBeNull()
    expect(match?.cta).toBe('listing')
  })

  it('marks a transfer review as having no experience to open', () => {
    const match = get('From Accra: Private Airport Transfer Pickup & Drop off Services')
    expect(match?.href ?? null).toBeNull()
    expect(match?.cta).toBe('none')
  })

  it('never links a review to a transfer when a real tour shares its tokens', () => {
    const match = get('Transport form Accra to Cape Coast')
    expect(match?.href ?? null).toBeNull()
    expect(match?.cta).toBe('none')
  })

  it('leaves unmatched titles on the destination fallback', () => {
    expect(get('Travio Ghana LTD')?.cta).toBe('listing')
  })

  it('keys by title, so repeated rows resolve once', () => {
    const map = resolveReviewTitleMatches(
      [
        { tourTitle: 'Cape Coast Castle, Elmina Castle & Kakum National Park Day Tour' },
        { tourTitle: 'Cape Coast Castle, Elmina Castle & Kakum National Park Day Tour' },
      ],
      TOURS,
    )
    expect(map.size).toBe(1)
  })

  it('copes with an empty catalogue: destination fallback, no tour link', () => {
    const match = resolveReviewTitleMatches([{ tourTitle: 'Cape Coast Castle Tour' }], [])
      .get(reviewTitleKey('Cape Coast Castle Tour'))
    expect(match?.href).toBeNull()
    expect(match?.cta).toBe('listing')
  })
})

describe('selectDistinctReviews', () => {
  it('keeps one review per tour, in order', () => {
    const rows = [
      { id: 'a', tourTitle: 'Cape Coast Castle Day Tour' },
      { id: 'b', tourTitle: 'Cape  Coast   Castle Day Tour' },
      { id: 'c', tourTitle: 'Accra City Tour' },
      { id: 'd', tourTitle: 'cape coast castle day tour' },
    ]
    expect(selectDistinctReviews(rows).map((r) => r.id)).toEqual(['a', 'c'])
  })

  it('keeps everything when every tour is different', () => {
    const rows = [{ id: 'a', tourTitle: 'A' }, { id: 'b', tourTitle: 'B' }]
    expect(selectDistinctReviews(rows)).toHaveLength(2)
  })

  it('drops rows with no tour title', () => {
    expect(selectDistinctReviews([{ id: 'a', tourTitle: '  ' }])).toEqual([])
  })
})
