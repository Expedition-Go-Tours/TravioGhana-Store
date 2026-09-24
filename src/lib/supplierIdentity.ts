/**
 * The operator whose TripAdvisor / GetYourGuide listings were scraped into
 * `public/data/externalReviews.json`.
 *
 * The scraped dataset carries no operator field — the rows *are* this company's
 * listings — so scraped reviews may only ever be attributed to tours this
 * supplier operates. Other operators on the platform can publish identical
 * itineraries and the matcher is title-based, so without this gate a competitor's
 * "Cape Coast Castle & Kakum" tour inherited the 588 TripAdvisor + 208
 * GetYourGuide reviews belonging to this company's product.
 *
 * This is the single source of truth for that scope; the value matches what the
 * API returns in `supplierName` for these tours.
 */
export const SCRAPED_REVIEW_SUPPLIER = 'Expedition-Go Tours LTD'

/**
 * Compare supplier names loosely: case, punctuation and separators are ignored
 * ("Expedition-Go Tours LTD" === "Expedition Go Tours Ltd"), and "Limited" is
 * treated as "Ltd".
 */
function normalizeSupplierName(value: string): string {
  return value
    .toLowerCase()
    .replace(/\blimited\b/g, 'ltd')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

const TARGET_SUPPLIER = normalizeSupplierName(SCRAPED_REVIEW_SUPPLIER)

/**
 * Whether a tour's `supplierName` is the scraped-review operator.
 *
 * Fails closed: a missing or unrecognised supplier is never eligible, so scraped
 * social proof can never leak onto another operator's tour.
 */
export function isScrapedReviewSupplier(name?: string | null): boolean {
  if (!name) return false
  return normalizeSupplierName(name) === TARGET_SUPPLIER
}
