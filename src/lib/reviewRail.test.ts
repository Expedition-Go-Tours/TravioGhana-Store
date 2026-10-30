import { describe, expect, it } from 'vitest'
import { resolveReviewMatches, selectDistinctReviews, type MatchableCardTour } from './reviewRail'

const TOURS: MatchableCardTour[] = [
  {
    id: 'tour_cape',
    slug: 'cape-coast-castle-and-kakum-national-park-day-tour',
    title: 'Cape Coast Castle and Kakum National Park Day Tour',
    location: 'Cape Coast, Ghana',
    supplierName: 'Expedition-Go Tours LTD',
    image: 'https://cdn.example/cape-coast.jpg',
  },
  {
    id: 'tour_accra',
    slug: 'accra-guided-city-tour-cultural-and-historical-experience',
    title: 'Accra Guided City Tour & Cultural Experience',
    location: 'Accra, Ghana',
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
    id: 'tour_north',
    slug: 'northern-safari',
    title: 'Northern Safari',
    location: 'Tamale, Ghana',
    supplierName: 'Someone Else Ltd',
    image: 'https://cdn.example/other-operator.jpg',
  },
]

describe('resolveReviewMatches', () => {
  it('links the CTA to the specific tour and uses its photo', () => {
    const match = resolveReviewMatches(
      [{ id: 'r1', tourTitle: 'Cape Coast Castle & Kakum National Park Tour' }],
      TOURS,
    ).get('r1')

    expect(match?.href).toBe('/tour/tour_cape/cape-coast-castle-and-kakum-national-park-day-tour')
    expect(match?.image).toBe('https://cdn.example/cape-coast.jpg')
  })

  it('falls back to the tour photo gallery', () => {
    const match = resolveReviewMatches(
      [{ id: 'r1', tourTitle: 'Accra Guided City Tour Experience' }],
      TOURS,
    ).get('r1')

    expect(match?.image).toBe('https://cdn.example/accra-1.jpg')
    expect(match?.href).toBe('/tour/tour_accra/accra-guided-city-tour-cultural-and-historical-experience')
  })

  it('prefers a thumbnail the review already carries', () => {
    const match = resolveReviewMatches(
      [{ id: 'r1', tourTitle: 'Cape Coast Castle Tour', tourThumbnail: 'https://cdn.example/scraped.jpg' }],
      TOURS,
    ).get('r1')

    expect(match?.image).toBe('https://cdn.example/scraped.jpg')
    expect(match?.href).toBe('/tour/tour_cape/cape-coast-castle-and-kakum-national-park-day-tour')
  })

  it('fails closed for another operator\'s tour', () => {
    expect(resolveReviewMatches([{ id: 'r1', tourTitle: 'Northern Safari' }], TOURS).has('r1')).toBe(false)
  })

  it('leaves unmatched reviews without a match', () => {
    const map = resolveReviewMatches(
      [
        { id: 'r1', tourTitle: 'Travio Ghana LTD' },
        { id: 'r2', tourTitle: 'Cape Coast Castle Day Tour' },
      ],
      TOURS,
    )
    expect(map.has('r1')).toBe(false)
    expect(map.get('r2')?.href).toContain('/tour/tour_cape/')
  })

  it('never links a review to a transfer product', () => {
    const match = resolveReviewMatches(
      [{ id: 'r1', tourTitle: 'From Accra: The Cape Coast Day Tour Guided Experience' }],
      TOURS,
    ).get('r1')

    // The transport listing shares every token, but it is not the experience:
    // the real Cape Coast tour wins instead.
    expect(match?.href).toContain('/tour/tour_cape/')
    expect(match?.href).not.toContain('transport')
    expect(match?.image).toBe('https://cdn.example/cape-coast.jpg')
  })

  it('has no specific link when the only candidate is a transfer', () => {
    const transportOnly = TOURS.filter((t) => t.category === 'transport')
    const match = resolveReviewMatches(
      [{ id: 'r1', tourTitle: 'Transport form Accra to Cape Coast' }],
      transportOnly,
    ).get('r1')

    expect(match).toBeUndefined()
  })

  it('copes with an empty catalogue', () => {
    expect(resolveReviewMatches([{ id: 'r1', tourTitle: 'Cape Coast Castle Tour' }], []).size).toBe(0)
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
