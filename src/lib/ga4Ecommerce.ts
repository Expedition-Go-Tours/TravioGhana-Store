/**
 * GA4 ecommerce funnel events for the storefront.
 *
 * Why this exists: the GA4 ecommerce report showed every product with
 * `Items viewed: 0` and `Items added to cart: 0` while `Items purchased` and
 * `Item revenue` were real. The reason is that the backend reports `purchase`
 * server-side (src/core/services/ga4Measurement.js on the API) while the
 * storefront sent only `page_view` — so the top of the funnel simply did not
 * exist and no product funnel could be read.
 *
 * Two contracts this file must keep:
 *
 * 1. THE ITEM SHAPE MATCHES THE BACKEND'S. `buildItem` over there sends
 *    { item_id: tourId, item_name: title, price, quantity: 1 } for `purchase`.
 *    If these differ — different id, different name — GA4 reports the same
 *    tour as two products and views/carts can never be joined to purchases.
 *    When the backend changes its item shape, change this one to match.
 *
 * 2. NEVER INVENT A PRICE. A view whose price is unknown omits `price`/`value`
 *    rather than sending 0: a real $0 is indistinguishable from "we didn't
 *    know" in every report built on top of it.
 *
 * The funnel mapping is deliberate, because this storefront has no separate
 * cart step: the traveller picks date/time/travellers on the tour page and
 * presses "Book now", which lands on the booking (checkout) page. So
 * "Book now" IS the add-to-cart moment in funnel terms.
 *
 *   view_item      → tour detail opened
 *   add_to_cart    → "Book now" pressed (the item is selected and priced)
 *   begin_checkout → booking/checkout page opened
 *   purchase       → backend, server-side, after the booking settles
 */

import { trackGaEvent } from './googleAnalytics'

/** The minimum a tour must expose for GA4 to treat it as one product. */
export interface Ga4TourItemSource {
  id: string
  title: string
  /** Optional: omitted from the item when null/absent, never sent as 0. */
  price?: number | null
}

export interface Ga4Item {
  item_id: string
  item_name: string
  quantity: number
  price?: number
}

/**
 * One GA4 item for a tour. Mirrors the backend's `buildItem` exactly — see
 * contract (1) above.
 */
export function tourItem(
  tour: Ga4TourItemSource,
  price: number | null | undefined,
  quantity = 1,
): Ga4Item {
  const item: Ga4Item = {
    item_id: tour.id,
    item_name: tour.title,
    quantity,
  }
  if (typeof price === 'number' && Number.isFinite(price) && price > 0) {
    item.price = price
  }
  return item
}

/** The value GA4 sums as event revenue: unit price × quantity, when known. */
function eventValue(price: number | null | undefined, quantity: number): number | undefined {
  if (typeof price !== 'number' || !Number.isFinite(price) || price <= 0) return undefined
  return price * quantity
}

function send(
  name: 'view_item' | 'add_to_cart' | 'begin_checkout',
  tour: Ga4TourItemSource,
  price: number | null | undefined,
  quantity: number,
  currency: string,
  extra: Record<string, unknown> = {},
): void {
  const value = eventValue(price, quantity)
  trackGaEvent(name, {
    currency,
    // `value` is what GA4's revenue metrics read; omitted when unknown.
    ...(value !== undefined ? { value } : {}),
    items: [tourItem(tour, price, quantity)],
    ...extra,
  })
}

/** The tour detail page was opened. Fires once per tour id per page view. */
export function trackViewItem(
  tour: Ga4TourItemSource,
  price: number | null | undefined,
  currency = 'USD',
): void {
  send('view_item', tour, price, 1, currency)
}

/**
 * The traveller selected this tour and is heading to checkout — the
 * add-to-cart moment in this storefront's flow (see the funnel mapping above).
 */
export function trackAddToCart(
  tour: Ga4TourItemSource,
  price: number | null | undefined,
  quantity = 1,
  currency = 'USD',
  extra: Record<string, unknown> = {},
): void {
  send('add_to_cart', tour, price, quantity, currency, extra)
}

/** The booking/checkout page was opened for this tour. */
export function trackBeginCheckout(
  tour: Ga4TourItemSource,
  price: number | null | undefined,
  quantity = 1,
  currency = 'USD',
): void {
  send('begin_checkout', tour, price, quantity, currency)
}
