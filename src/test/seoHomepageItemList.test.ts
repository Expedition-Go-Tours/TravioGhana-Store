import { describe, it, expect } from 'vitest'
import { buildHomepageItemListSchema } from '../components/SEO'

/**
 * The homepage is the landing page for the brand query, and it was publishing
 * 51 cards, 130 price elements and 33 crawlable tour links while its JSON-LD
 * held only Organization and WebSite. Every rating a visitor could read was
 * absent from the structured data, so the page could not qualify for a rating
 * treatment despite carrying the reviews.
 */
const TOUR = {
  id: 'cmt8ij61a00oc646p0sq1d8xq',
  title: 'Accra Guided City Tour',
  slug: 'accra-guided-city-tour',
  coverPhoto: 'https://res.cloudinary.com/demo/image.jpg',
  averageRating: 4.8,
  reviewCount: 63,
  startingPrice: 45,
  currency: 'USD',
  city: 'Accra',
}

type Schema = ReturnType<typeof buildHomepageItemListSchema>
type Entry = { '@type': string; position: number; item: Record<string, any> }
const entries = (schema: Schema) => schema.itemListElement as unknown as Entry[]

describe('buildHomepageItemListSchema', () => {
  it('emits a Product per tour, with its offer and rating', () => {
    const schema = buildHomepageItemListSchema([TOUR])
    expect(schema['@type']).toBe('ItemList')
    expect(schema.numberOfItems).toBe(1)
    // The list names itself, so a consumer reading the block alone knows what
    // it is looking at without inferring it from the page.
    expect(schema.name).toBe('Ghana tours and experiences')

    const [entry] = entries(schema)
    expect(entry['@type']).toBe('ListItem')
    expect(entry.position).toBe(1)
    expect(entry.item['@type']).toBe('Product')
    expect(entry.item.name).toBe(TOUR.title)
    expect(entry.item.image).toBe(TOUR.coverPhoto)
    // Absolute, and built from tourPath so it cannot drift from the card links.
    expect(entry.item.url).toBe(`https://www.travioghana.com/tour/${TOUR.id}/${TOUR.slug}`)
    expect(entry.item.offers).toMatchObject({ price: 45, priceCurrency: 'USD' })
    expect(entry.item.aggregateRating).toMatchObject({
      '@type': 'AggregateRating',
      ratingValue: 4.8,
      reviewCount: 63,
      bestRating: 5,
      worstRating: 1,
    })
  })

  it('de-duplicates a tour that appears in several homepage sections', () => {
    // top-rated and sell-out routinely overlap. Without this, one tour is
    // listed two or three times at different positions, which reads as padding.
    const schema = buildHomepageItemListSchema([TOUR, TOUR, { ...TOUR, id: 'other', slug: 'other' }])
    expect(schema.numberOfItems).toBe(2)
    expect(entries(schema).map((e) => e.position)).toEqual([1, 2])
    expect(new Set(entries(schema).map((e) => e.item.url)).size).toBe(2)
  })

  it('keeps the richest copy regardless of which section the tour arrived in', () => {
    // A section that does not project price or rating must not win over one
    // that does, or the surviving entry is the empty one. Asserted in both
    // orders: first-wins and last-wins are each a plausible implementation, and
    // only the scoring one is correct.
    const bare = { ...TOUR, startingPrice: null, averageRating: null, reviewCount: 0 }
    for (const input of [[bare, TOUR], [TOUR, bare]]) {
      const [entry] = entries(buildHomepageItemListSchema(input))
      expect(entry.item.offers.price).toBe(45)
      expect(entry.item.aggregateRating).toBeDefined()
    }
  })

  it('omits the price rather than claiming a tour is free', () => {
    // A zero price is a false claim. A missing one is just missing.
    const [entry] = entries(buildHomepageItemListSchema([{ ...TOUR, startingPrice: null }]))
    expect(entry.item.offers.price).toBeUndefined()
    // availability survives, so the Offer is still a valid, honest node.
    expect(entry.item.offers.availability).toBe('https://schema.org/InStock')
  })

  it('omits a rating that has no review count', () => {
    // Mirrors the gate in buildProductSchema: a ratingValue with no count is
    // not an AggregateRating, and a malformed one is a manual-action risk.
    expect(entries(buildHomepageItemListSchema([{ ...TOUR, reviewCount: 0 }]))[0].item.aggregateRating).toBeUndefined()
    expect(entries(buildHomepageItemListSchema([{ ...TOUR, averageRating: null }]))[0].item.aggregateRating).toBeUndefined()
  })

  it('skips entries with no id or no title', () => {
    const schema = buildHomepageItemListSchema([TOUR, { ...TOUR, id: '' }, { ...TOUR, title: '' }])
    expect(schema.numberOfItems).toBe(1)
  })

  it('names the brand as publisher, with the intended sameAs', () => {
    const schema = buildHomepageItemListSchema([TOUR])
    const publisher = schema.publisher as unknown as Record<string, unknown>
    expect(publisher).toMatchObject({ '@type': 'Organization', name: 'Travio Ghana' })
    expect(publisher.sameAs).not.toContain('facebook.com')
  })

  it('renders an empty list as numberOfItems 0 rather than omitting the block', () => {
    // Before the homepage fetch resolves the list is empty but present, so the
    // prerender does not have to tell "no tours" from "no schema".
    const schema = buildHomepageItemListSchema([])
    expect(schema.numberOfItems).toBe(0)
    expect(schema.itemListElement).toEqual([])
  })

  it('describes each tour by where it runs', () => {
    // The text a consumer has to render when it will not fetch the page. Built
    // from city and title rather than left empty, so the Product is not a bare
    // name and URL.
    const [entry] = entries(buildHomepageItemListSchema([TOUR]))
    expect(entry.item.description).toBe(`${TOUR.title} in Accra, Ghana`)
  })

  it('leaves off a description when the tour has no city', () => {
    const [entry] = entries(buildHomepageItemListSchema([{ ...TOUR, city: null }]))
    expect(entry.item.description).toBeUndefined()
  })

  it('builds item URLs through tourPath, matching the card links exactly', () => {
    // The schema URL and the rendered <a href> must be the same string. If they
    // diverge, the structured data describes a page that does not exist.
    const tour = { ...TOUR, id: 'a b', slug: 'c/d' }
    const [entry] = entries(buildHomepageItemListSchema([tour]))
    expect(entry.item.url).toBe('https://www.travioghana.com/tour/a%20b/c%2Fd')
  })

  it('numbers positions from 1, as the vocabulary requires', () => {
    // ListItem.position is 1-based. Distinct from the ordering test: this
    // asserts the absolute value, not merely that positions increase.
    const many = Array.from({ length: 3 }, (_, i) => ({ ...TOUR, id: `t${i}`, slug: `s${i}` }))
    expect(entries(buildHomepageItemListSchema(many)).map((e) => e.position)).toEqual([1, 2, 3])
  })

  it('gives every Product an Offer the search engines can price', () => {
    // An Offer with no price and no availability is not a usable offer, and a
    // Product with no Offer is not bookable. Both must be present on every item
    // regardless of how much data the section happened to project.
    for (const tour of [TOUR, { ...TOUR, startingPrice: null, averageRating: null, reviewCount: 0 }]) {
      const [entry] = entries(buildHomepageItemListSchema([tour]))
      expect(entry.item.offers).toBeDefined()
      expect(entry.item.offers['@type']).toBe('Offer')
      expect(entry.item.offers.availability).toBe('https://schema.org/InStock')
      expect(entry.item.offers.url).toBe(entry.item.url)
      expect(entry.item.offers.seller).toMatchObject({ '@type': 'Organization', name: 'Travio Ghana' })
    }
  })

  it('names a Brand on every Product, so the offer has an owner', () => {
    // Google flagged 9 of these as an invalid `brand` object and 13 as missing
    // one. The real defect is that the homepage items had no brand at all —
    // the tour detail pages were already emitting a well-formed
    // {"@type":"Brand"} node. Without a brand, a Product cannot be attributed
    // to the merchant whose refund policy its offer declares.
    for (const tour of [TOUR, { ...TOUR, id: 'other', slug: 'other' }]) {
      const [entry] = entries(buildHomepageItemListSchema([tour]))
      expect(entry.item.brand).toBeDefined()
      // An object, never a bare string: a string brand is the shape that
      // produced the "invalid object type" verdict in the first place.
      expect(typeof entry.item.brand).toBe('object')
      expect(entry.item.brand['@type']).toBe('Brand')
      expect(entry.item.brand.name).toBe('Travio Ghana')
    }
  })

  it('gives every Offer the return policy and shipping the report demands', () => {
    // "Missing field 'hasMerchantReturnPolicy' (in 'offers')" and the same for
    // 'shippingDetails' were reported against these Products. Both are required
    // on every offer, on every entry, including the one that has no price.
    for (const tour of [TOUR, { ...TOUR, startingPrice: null, averageRating: null, reviewCount: 0 }]) {
      const [entry] = entries(buildHomepageItemListSchema([tour]))
      const offers = entry.item.offers
      expect(offers.hasMerchantReturnPolicy).toBeDefined()
      expect(offers.hasMerchantReturnPolicy['@type']).toBe('MerchantReturnPolicy')
      expect(offers.shippingDetails).toBeDefined()
      expect(offers.shippingDetails['@type']).toBe('OfferShippingDetails')
    }
  })

  it('publishes the same policy on every entry rather than per-tour copies', () => {
    // The homepage merges tours from several sections; the policy describes the
    // merchant, not the tour, so it must not vary by which section won.
    const schema = buildHomepageItemListSchema([
      TOUR,
      { ...TOUR, id: 'a', slug: 'a' },
      { ...TOUR, id: 'b', slug: 'b', startingPrice: 999 },
    ])
    const policies = entries(schema).map((e) => JSON.stringify(e.item.offers.hasMerchantReturnPolicy))
    expect(new Set(policies).size).toBe(1)
  })
})
