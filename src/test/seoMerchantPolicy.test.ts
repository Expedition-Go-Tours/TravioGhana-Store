import { describe, it, expect } from 'vitest'
import { buildProductSchema, buildHomepageItemListSchema } from '../components/SEO'
import { RETURN_POLICY_COUNTRIES } from '../lib/seo/returnPolicy'

/**
 * The offer-level merchant policy this site publishes — the refund terms, and
 * the e-delivery terms standing in for shipping — is duplicated in two repos
 * that deploy independently: here, and in
 * `Expedition-Go-Backend-v2` → `src/core/domain/prerenderController.js`. Tour
 * pages are prerendered by the backend and re-rendered by this app, so both
 * copies reach the same URL depending on whether the visitor runs JavaScript.
 *
 * They must therefore be identical, and the only thing that can enforce that
 * across a repo boundary is a test in each repo failing when one side moves.
 * This is the `GHA` booking-prefix lesson: a plausible literal, duplicated,
 * with nothing checking the second copy.
 *
 * The canonical values, checked against the wording of
 * https://www.travioghana.com/refund-policy — "cancel at least 24 hours before
 * the scheduled start time: receive a full refund of the booking price".
 */

/**
 * Pinned verbatim. If this array needs to change, the backend's
 * `RETURN_POLICY_COUNTRIES` must change in the same commit — narrowing it to
 * GH alone would drop most of the site's customers from the policy's scope.
 */
const EXPECTED_COUNTRIES = [
  'AE', 'AU', 'BE', 'CA', 'CH', 'DE', 'DK', 'FR', 'GB', 'GH', 'GR', 'IE',
  'IT', 'KE', 'NG', 'NL', 'NO', 'PT', 'SE', 'TG', 'TN', 'UG', 'US', 'ZA',
]

const offerOf = (product: Record<string, any>) => product.offers
const itemOfferOf = (itemList: ReturnType<typeof buildHomepageItemListSchema>) =>
  (itemList.itemListElement as unknown as { item: Record<string, any> }[])[0].item.offers

const productSchema = () =>
  buildProductSchema({
    title: 'Accra Guided City Tour',
    description: 'Walk the walled city.',
    image: 'https://res.cloudinary.com/demo/image.jpg',
    price: 45,
    currency: 'USD',
    ratingValue: 4.8,
    reviewCount: 63,
    slug: 'accra-guided-city-tour',
    id: 'cmt8ij61a00oc646p0sq1d8xq',
    city: 'Accra',
  })

const homepageItemOffer = () =>
  itemOfferOf(
    buildHomepageItemListSchema([
      {
        id: 'cmt8ij61a00oc646p0sq1d8xq',
        title: 'Accra Guided City Tour',
        slug: 'accra-guided-city-tour',
        coverPhoto: 'https://res.cloudinary.com/demo/image.jpg',
        averageRating: 4.8,
        reviewCount: 63,
        startingPrice: 45,
        currency: 'USD',
        city: 'Accra',
      },
    ]),
  )

describe('refund policy', () => {
  it('covers exactly the markets that actually book or review', () => {
    // The backend's copy of this list is derived from DailyTourStats.topCountry
    // and the stated origin on the external reviews. Pinned rather than derived
    // so that a change is a deliberate two-repo edit.
    expect([...RETURN_POLICY_COUNTRIES]).toEqual(EXPECTED_COUNTRIES)
  })

  it('stays within the 50 countries Google accepts', () => {
    expect(RETURN_POLICY_COUNTRIES.length).toBeLessThanOrEqual(50)
    expect(RETURN_POLICY_COUNTRIES.length).toBeGreaterThan(0)
  })

  it('uses two-letter ISO 3166-1 alpha-2 codes, not names', () => {
    for (const code of RETURN_POLICY_COUNTRIES) expect(code).toMatch(/^[A-Z]{2}$/)
  })

  it('states the 24-hour window and full refund the policy page promises', () => {
    const policy = offerOf(productSchema()).hasMerchantReturnPolicy
    expect(policy['@type']).toBe('MerchantReturnPolicy')
    expect(policy.returnPolicyCategory).toBe('https://schema.org/MerchantReturnFiniteReturnWindow')
    expect(policy.merchantReturnDays).toBe(1)
    expect(policy.refundType).toBe('https://schema.org/FullRefund')
    expect(policy.returnFees).toBe('https://schema.org/FreeReturn')
  })

  it('omits the physical-goods fields, which describe a shipment that never happens', () => {
    const policy = offerOf(productSchema()).hasMerchantReturnPolicy
    // `returnMethod` is ReturnByMail / ReturnInStore, `itemCondition` is
    // New / Used / Refurbished. A booked tour is returned from by not turning
    // up, and arrives in the condition it is booked in. Declaring either would
    // be a false statement, and this is exactly what generic "add
    // hasMerchantReturnPolicy" guidance recommends adding.
    expect(policy.returnMethod).toBeUndefined()
    expect(policy.itemCondition).toBeUndefined()
  })

  it('omits merchantReturnLink, which cannot satisfy an offer-level field', () => {
    // Google documents it as an Organization-level "Option B" only; it appears
    // nowhere in the merchant-listing documentation the report validates against.
    expect(offerOf(productSchema()).hasMerchantReturnPolicy.merchantReturnLink).toBeUndefined()
  })
})

describe('shipping details', () => {
  it('states e-delivery: no charge, in the currency the offers are priced in', () => {
    const rate = offerOf(productSchema()).shippingDetails.shippingRate
    expect(rate['@type']).toBe('MonetaryAmount')
    expect(Number(rate.value)).toBe(0)
    expect(rate.currency).toBe('USD')
  })

  it('declares the operating country as the destination', () => {
    const dest = offerOf(productSchema()).shippingDetails.shippingDestination
    expect(dest['@type']).toBe('DefinedRegion')
    expect(dest.addressCountry).toBe('GH')
  })

  it('promises instant confirmation rather than a two-day delivery chain', () => {
    // The generic fix for this warning adds a 1-2 day transit time. Nothing is
    // shipped here, so a transit window of a day or more would be a delivery
    // promise the product cannot keep — and inaccurate structured data is a
    // manual-action risk, which is worse than the warning being fixed.
    const delivery = offerOf(productSchema()).shippingDetails.deliveryTime
    expect(delivery['@type']).toBe('ShippingDeliveryTime')
    expect(delivery.handlingTime).toMatchObject({ unitCode: 'DAY', minValue: 0 })
    expect(Number(delivery.handlingTime.maxValue)).toBeGreaterThanOrEqual(
      Number(delivery.handlingTime.minValue),
    )
    expect(Number(delivery.transitTime.minValue)).toBe(0)
    expect(Number(delivery.transitTime.maxValue)).toBe(0)
  })
})

describe('the two emitters cannot drift apart', () => {
  it('publishes an identical refund policy on the tour page and the homepage', () => {
    expect(homepageItemOffer().hasMerchantReturnPolicy).toEqual(
      offerOf(productSchema()).hasMerchantReturnPolicy,
    )
  })

  it('publishes identical shipping details on the tour page and the homepage', () => {
    expect(homepageItemOffer().shippingDetails).toEqual(
      offerOf(productSchema()).shippingDetails,
    )
  })

  it('hands each caller its own policy object, so one page cannot mutate another', () => {
    const first = offerOf(productSchema()).hasMerchantReturnPolicy
    const second = offerOf(productSchema()).hasMerchantReturnPolicy
    expect(first).not.toBe(second)
    first.merchantReturnDays = 999
    expect(offerOf(productSchema()).hasMerchantReturnPolicy.merchantReturnDays).toBe(1)
  })

  it('does not let a mutation of the country list leak into later renders', () => {
    // The exported array is shared, so the node must spread it. A caller that
    // pushed to the list in place would permanently corrupt every later render.
    const policy = offerOf(productSchema()).hasMerchantReturnPolicy
    expect(Array.isArray(policy.applicableCountry)).toBe(true)
    expect(policy.applicableCountry).not.toBe(RETURN_POLICY_COUNTRIES)
    expect(policy.applicableCountry).toEqual([...RETURN_POLICY_COUNTRIES])
  })
})