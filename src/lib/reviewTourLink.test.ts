import { describe, it, expect } from 'vitest'
import { buildTourLink, matchDestination, matchTourForTitle, STATIC_DESTINATIONS } from './reviewTourLink'

const AVAILABLE = [
  'Accra',
  'Cape Coast',
  'Kumasi',
  'Eastern Region',
  'Greater Accra',
  'Volta Region',
  'Elmina',
  'Kakum',
  'Northern Region',
]

describe('matchDestination', () => {
  it('maps each real external review title to a local destination', () => {
    expect(matchDestination('Cape Coast Castle, Elmina Castle & Kakum National Park Day Tour', AVAILABLE)).toBe('Cape Coast')
    expect(matchDestination('Accra Guided City Tour: Cultural and Historical Experience', AVAILABLE)).toBe('Accra')
    expect(matchDestination('Shai Hills Safari & Akosombo Boat Cruise Day Tour', AVAILABLE)).toBe('Greater Accra')
    expect(matchDestination('From Accra: The Cape Coast Day Tour Guided Experience', AVAILABLE)).toBe('Cape Coast')
    expect(matchDestination('Accra Guided City Tour Experience', AVAILABLE)).toBe('Accra')
    expect(matchDestination('Accra Mini Safari, Rock Climbing, Museum & Boat Cruise Tour', AVAILABLE)).toBe('Accra')
    expect(matchDestination('Kotoka Domestic Airport Transfer with Mini Accra City Tour', AVAILABLE)).toBe('Accra')
    expect(matchDestination('Accra Sankofa Gallery Art Tour & Candle Making Workshop', AVAILABLE)).toBe('Accra')
  })

  it('prefers the specific attraction over the generic city in the title', () => {
    expect(matchDestination('From Accra: Waterfalls, Aburi Gardens & Cocoa Farm Day Tour', AVAILABLE)).toBe('Eastern Region')
    expect(matchDestination('Boti Falls, Umbrella Rock, Aburi Gardens & Cocoa Farm Tour', AVAILABLE)).toBe('Eastern Region')
  })

  it('falls through to a lower-priority destination when the best one is unavailable', () => {
    expect(matchDestination('From Accra: Waterfalls, Aburi Gardens & Cocoa Farm Day Tour', ['Accra'])).toBe('Accra')
  })

  it('matches destinations that carry a region/country suffix', () => {
    expect(matchDestination('Cape Coast Castle, Elmina Castle & Kakum National Park Day Tour', ['Cape Coast, Ghana'])).toBe('Cape Coast, Ghana')
  })

  it('returns null when nothing local applies', () => {
    expect(matchDestination('Boti Falls, Umbrella Rock, Aburi Gardens & Cocoa Farm Tour', ['Accra'])).toBeNull()
    expect(matchDestination('Travio Ghana LTD', AVAILABLE)).toBeNull()
  })
})

describe('buildTourLink', () => {
  it('builds an encoded local tours link', () => {
    expect(buildTourLink('Cape Coast')).toBe('/tours?place=Cape%20Coast')
  })

  it('falls back to all local tours when no destination resolves', () => {
    expect(buildTourLink(null)).toBe('/tours')
  })
})

describe('STATIC_DESTINATIONS', () => {
  it('derives destination names without the Ghana suffix', () => {
    expect(STATIC_DESTINATIONS).toContain('Accra')
    expect(STATIC_DESTINATIONS).toContain('Cape Coast')
    expect(STATIC_DESTINATIONS).not.toContain('Accra, Ghana')
  })
})

describe('matchTourForTitle', () => {
  const TOURS = [
    { title: 'Cape Coast Castle, Elmina Castle & Kakum National Park Day Tour', location: 'Cape Coast, Ghana' },
    { title: 'Boti Falls & Aburi Botanical Gardens Day Trip', location: 'Eastern Region, Ghana' },
    { title: 'Boti Falls Hike & Eastern Region Day Trip', location: 'Eastern Region, Ghana' },
    { title: 'Shai Hills Rock Climbing & Nature Walk', location: 'Greater Accra, Ghana' },
    { title: 'Lake Volta Sunset Cruise Day Tour', location: 'Volta Region, Ghana' },
    { title: 'Full Day Accra City & Cultural Experience', location: 'Accra, Ghana' },
    { title: 'Accra Street Food & Nightlife Tour', location: 'Accra, Ghana' },
    { title: 'Kumasi Cultural Walk & Ashanti Heritage Tour', location: 'Kumasi, Ghana' },
  ]

  const matchedTitle = (reviewTitle: string, tours = TOURS) =>
    matchTourForTitle(reviewTitle, tours)?.title ?? null

  it('maps each real external review title to the right tour', () => {
    expect(matchedTitle('Cape Coast Castle, Elmina Castle & Kakum National Park Day Tour'))
      .toBe('Cape Coast Castle, Elmina Castle & Kakum National Park Day Tour')
    expect(matchedTitle('Cape Coast Castle, Elmina Castle & Kakum National Park Day Tour', [
      { title: 'Cape Coast Castles & Heritage Day Tour', location: 'Cape Coast, Ghana' },
    ])).toBe('Cape Coast Castles & Heritage Day Tour')
    expect(matchedTitle('From Accra: The Cape Coast Day Tour Guided Experience'))
      .toBe('Cape Coast Castle, Elmina Castle & Kakum National Park Day Tour')
    expect(matchedTitle('From Accra: Waterfalls, Aburi Gardens & Cocoa Farm Day Tour'))
      .toBe('Boti Falls & Aburi Botanical Gardens Day Trip')
    expect(matchedTitle('Boti Falls, Umbrella Rock, Aburi Gardens & Cocoa Farm Tour'))
      .toBe('Boti Falls & Aburi Botanical Gardens Day Trip')
    expect(matchedTitle('Shai Hills Safari & Akosombo Boat Cruise Day Tour'))
      .toBe('Shai Hills Rock Climbing & Nature Walk')
    expect(matchedTitle('Accra Guided City Tour: Cultural and Historical Experience'))
      .toBe('Full Day Accra City & Cultural Experience')
    expect(matchedTitle('Accra Guided City Tour Experience'))
      .toBe('Full Day Accra City & Cultural Experience')
    expect(matchedTitle('Accra Mini Safari, Rock Climbing, Museum & Boat Cruise Tour'))
      .toBe('Shai Hills Rock Climbing & Nature Walk')
    expect(matchedTitle('Kumasi Cultural and Heritage Day Tour'))
      .toBe('Kumasi Cultural Walk & Ashanti Heritage Tour')
  })

  it('falls back to attraction keywords when the titles do not overlap', () => {
    const easternOnly = [{ title: 'Boti Falls Hike & Eastern Region Day Trip', location: 'Eastern Region, Ghana' }]
    expect(matchedTitle('From Accra: Waterfalls, Aburi Gardens & Cocoa Farm Day Tour', easternOnly))
      .toBe('Boti Falls Hike & Eastern Region Day Trip')

    const voltaOnly = [{ title: 'Lake Volta Sunset Cruise Day Tour', location: 'Volta Region, Ghana' }]
    expect(matchedTitle('Shai Hills Safari & Akosombo Boat Cruise Day Tour', voltaOnly))
      .toBe('Lake Volta Sunset Cruise Day Tour')
  })

  it('never matches on generic city words alone', () => {
    expect(matchedTitle('Accra Guided City Tour Experience', [
      { title: 'Accra Street Food & Nightlife Tour', location: 'Accra, Ghana' },
    ])).toBeNull()
    expect(matchedTitle('Kotoka Domestic Airport Transfer with Mini Accra City Tour')).toBeNull()
    expect(matchedTitle('Accra Sankofa Gallery Art Tour & Candle Making Workshop')).toBeNull()
  })

  it('never matches unrelated parks through the shared "National Park" suffix', () => {
    expect(matchedTitle('Cape Coast Castle, Elmina Castle & Kakum National Park Day Tour', [
      { title: 'The Mole National Park Tour', location: 'Northern Region, Ghana' },
    ])).toBeNull()
  })

  it('returns null for business-level titles and empty input', () => {
    expect(matchedTitle('Travio Ghana LTD')).toBeNull()
    expect(matchTourForTitle('', TOURS)).toBeNull()
    expect(matchTourForTitle('Cape Coast Castle Day Tour', [])).toBeNull()
  })
})
