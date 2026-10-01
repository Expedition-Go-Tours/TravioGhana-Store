import listingTours from '../data/reviewListingTours.json'

/**
 * Which of our tours each scraped listing actually is.
 *
 * Matching by title cannot answer this. Fuzzy title scoring asked "how much do
 * these two strings overlap", and the answer was frequently the wrong tour:
 *
 *  - GetYourGuide's `From Accra: The Cape Coast Day Tour Guided Experience`
 *    (211 reviews) scores 0.8750 against `Transport form Accra to Cape Coast`
 *    but only 0.7222 against the Cape Coast Castle tour it really is. The
 *    transport listing wins because it shares the generic token `accra`, and a
 *    short title out-scores a long one on Dice. No threshold separates this
 *    from legitimate matches: correct matches score as low as 0.7333 while this
 *    wrong one scores 0.8750.
 *  - `Boti Falls, Umbrella Rock, Aburi Gardens & Cocoa Farm Tour` ties at
 *    0.7857 / 0.7857 against two different Aburi tours, so the winner was
 *    whichever happened to come first in the list.
 *
 * Every listing in `data/reviewListingTours.json` was confirmed against its
 * live page before being recorded — each one is sold by Expedition-Go Tours /
 * Expedition-Go Tours Ltd (our own listings), and the platform's current title
 * is our tour's title verbatim:
 *
 *  - t834942 renders as "Cape Coast Castle, Elmina Castle & Kakum National
 *    Park Tour" — the *same* tour as the 588-review TripAdvisor listing, so the
 *    two legitimately combine to 799 on that one tour.
 *  - t866545 renders as "From Accra: Waterfall, Aburi Gardens & Cocoa Farm Day
 *    Tour", t1170966 as "Accra: Shai Hills Safari & Akosombo Boat Cruise Day
 *    Tour", t839108 as "Accra Guided City Tour: Cultural and Historical
 *    Experience", d25225556 as "From Accra: Private Airport Transfer, Pickup &
 *    Drop-off Services".
 *
 * The scraper config still carries the *old* URL slugs as titles, because the
 * platform renames a listing whenever its slug changes. The map, not the slug,
 * is the authority.
 *
 * Deliberately absent:
 *
 *  - `tripadvisor-34552807` "Ghanaian Cultural Art Tour and Scented Candle
 *    Making Experience" — could be the heritage tour or the Sankofa gallery
 *    tour, and the data cannot say which.
 *  - `getyourguide-...-t1243777` "Kotoka Domestic Airport Transfer with Mini
 *    Accra City Tour" — an airport transfer with a city tour, which matches
 *    neither the airport lounge listing nor any single tour.
 *
 * Both carry null official totals and zero review rows, so leaving them
 * undeclared costs no social proof today: their own platform wording matches no
 * tour of ours exactly, and that is now the only way a listing is claimed.
 */
const DECLARED_TOURS = listingTours as Record<string, string>

/** `_comment` is the only non-id key in the JSON, and never a product id. */
const isProductId = (key: string): boolean => key !== '_comment'

/**
 * Which tour a scraped listing is, or null when the payload does not say.
 *
 * The map wins when it has an entry, because the payload's `tourTitle` is the
 * platform's *listing* title — a URL slug that drifts whenever the platform
 * rotates one, which is how `From Accra: The Cape Coast Day Tour Guided
 * Experience` came to be matched against a transfer. The map records what the
 * listing actually sells.
 *
 * Without an entry the payload's own title is used, and it is only ever acted
 * on if it *is* one of our tours exactly. That is the whole safety property:
 * a stale title resolves to "this tour, precisely" or to nothing at all, never
 * to "something similar" — resemblance was the bug.
 *
 * So the gate is identity, not declaration. `selectMatchedProducts` compares
 * whatever this returns against the tour's title with `sameTourTitle`. Declaring
 * a listing is how its identity is *kept* accurate when the platform renames it,
 * and the test `declares every listing that carries review totals` makes sure
 * none that matters is ever left to drift.
 */
export function listingTourTitle(product: {
  id?: string | null
  tourTitle?: string | null
}): string | null {
  if (product.id) {
    const declared = DECLARED_TOURS[product.id]
    if (typeof declared === 'string' && declared.length > 0) return declared
  }
  return typeof product.tourTitle === 'string' && product.tourTitle.length > 0
    ? product.tourTitle
    : null
}

/**
 * Every listing that has been declared, as `id → tour title`.
 *
 * Used by the tests to assert the map still describes real listings, and by the
 * scraper to re-title the products it pushes to the backend.
 */
export function declaredListingTours(): Record<string, string> {
  const out: Record<string, string> = {}
  for (const [key, value] of Object.entries(DECLARED_TOURS)) {
    if (isProductId(key) && typeof value === 'string') out[key] = value
  }
  return out
}
