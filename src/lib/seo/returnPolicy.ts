/**
 * Offer-level merchant policy shared by every JSON-LD `Offer` this site emits.
 *
 * CANONICAL SOURCE — `Expedition-Go-Backend-v2` →
 * `src/core/domain/prerenderController.js` (`RETURN_POLICY_COUNTRIES` +
 * `returnPolicyNode`). That copy is authoritative because tour pages are
 * prerendered by the backend, so the block Google reads first comes from
 * there. This is a deliberate second copy: the two repos deploy separately and
 * cannot share a module.
 *
 * Because two copies exist, both are pinned by tests against these literals
 * (`src/test/seoMerchantPolicy.test.ts` here, `prerenderController.test.js`
 * there). The cross-repo drift that a literal like this invites is not
 * hypothetical — the `GHA` booking prefix drifted for exactly this reason, so
 * changing a number below is a two-repo edit or it is a bug.
 */

/**
 * The countries Travio Ghana's cancellation policy is offered in, as ISO
 * 3166-1 alpha-2 — `applicableCountry` means "where the product is sold and
 * will be returned from", which for an experience is the customer's own
 * consumer-protection jurisdiction.
 *
 * Derived from where bookings and reviews actually come from rather than
 * guessed: DailyTourStats.topCountry plus the stated origin on the external
 * reviews that carry one. Do not narrow this to GH alone — the majority of
 * customers booking this site are not in Ghana.
 */
export const RETURN_POLICY_COUNTRIES = [
  'AE', 'AU', 'BE', 'CA', 'CH', 'DE', 'DK', 'FR', 'GB', 'GH', 'GR', 'IE',
  'IT', 'KE', 'NG', 'NL', 'NO', 'PT', 'SE', 'TG', 'TN', 'UG', 'US', 'ZA',
] as const

/**
 * The refund policy, stated as the refund policy page actually words it: cancel
 * at least 24 hours before the scheduled start and receive a full refund of the
 * booking price.
 *
 * `MerchantReturnFiniteReturnWindow` + `merchantReturnDays: 1` is that 24-hour
 * window.
 *
 * Omitted deliberately, and worth stating plainly because most "fix missing
 * hasMerchantReturnPolicy" advice gets these wrong:
 *
 * - `returnMethod` — `ReturnByMail` / `ReturnInStore` describe physical goods.
 *   A booked tour is returned from by not turning up; there is nothing to post
 *   back. Declaring it would be a false statement to Search Console.
 * - `itemCondition` — `New` / `Used` / `Refurbished` likewise describes goods.
 * - `merchantReturnLink` — offered as "Option B" for Organization-level markup,
 *   but it appears nowhere in Google's merchant-listing documentation, so it
 *   cannot satisfy a field validated against `offers`.
 */
export function returnPolicyNode(): Record<string, unknown> {
  return {
    '@type': 'MerchantReturnPolicy',
    applicableCountry: [...RETURN_POLICY_COUNTRIES],
    returnPolicyCategory: 'https://schema.org/MerchantReturnFiniteReturnWindow',
    merchantReturnDays: 1,
    returnFees: 'https://schema.org/FreeReturn',
    refundType: 'https://schema.org/FullRefund',
  }
}

/**
 * `shippingDetails`, which Search Console's merchant-listing report requires
 * on any `Offer` and reports as "Missing field 'shippingDetails' (in
 * 'offers')" when absent.
 *
 * A tour has no shipping, so this is stated in the only terms that are true of
 * one: what is "delivered" is the booking confirmation, at no charge, issued
 * essentially immediately. Hence a zero rate, no carrier transit, and a
 * handling window that is the only real delay in the chain.
 *
 * This is deliberately NOT a two-day shipping chain, which is what generic
 * "add shippingDetails" guidance suggests. Asserting a delivery time for a
 * product that is not delivered would be inaccurate structured data, and
 * inaccurate structured data is a manual-action risk — a worse outcome than the
 * warning this clears.
 *
 * `shippingDestination` is GH because that is where the experience runs from
 * and where a return would be made from — the same reading the backend applies
 * to `applicableCountry`.
 */
export function shippingDetailsNode(): Record<string, unknown> {
  return {
    '@type': 'OfferShippingDetails',
    shippingRate: {
      '@type': 'MonetaryAmount',
      value: '0',
      // Matches the currency the offers themselves are priced in (USD). A
      // zero amount is currency-independent in practice, but the property is
      // required and must be a valid ISO 4217 code.
      currency: 'USD',
    },
    shippingDestination: {
      '@type': 'DefinedRegion',
      addressCountry: 'GH',
    },
    deliveryTime: {
      '@type': 'ShippingDeliveryTime',
      handlingTime: {
        '@type': 'QuantitativeValue',
        minValue: 0,
        maxValue: 1,
        unitCode: 'DAY',
      },
      // Instant: the confirmation is in the app at booking time.
      transitTime: {
        '@type': 'QuantitativeValue',
        minValue: 0,
        maxValue: 0,
        unitCode: 'DAY',
      },
    },
  }
}