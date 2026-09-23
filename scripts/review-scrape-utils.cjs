/**
 * review-scrape-utils.cjs — pure helpers shared by the review scraper and its
 * unit tests. CommonJS so the standalone `node scripts/sync-reviews.cjs` run
 * works without a build step.
 */

/**
 * Build the TripAdvisor page URL for a review page. The configured product URLs
 * look like:
 *   https://www.tripadvisor.com/AttractionProductReview-g293797-d24189724-Cape_Coast_...html
 * Page 2+ must insert "-or{offset}-" right after the `d{id}` segment (the form
 * TripAdvisor redirects to):
 *   https://www.tripadvisor.com/AttractionProductReview-g293797-d24189724-or10-Cape_Coast_...html
 * (The previous `-Review-` replacement never matched "AttractionProductReview".)
 */
function buildTripAdvisorPageUrl(url, pageNum) {
  if (!url || pageNum <= 1) return url
  const offset = (pageNum - 1) * 10
  if (/-or\d+-/.test(url)) {
    return url.replace(/-or\d+-/, `-or${offset}-`)
  }
  const replaced = url.replace(/(-d\d+)(-)/, `$1-or${offset}$2`)
  return replaced === url ? url : replaced
}

/**
 * GetYourGuide paginates with ?page=N. Preserve any existing query string.
 */
function buildGetYourGuidePageUrl(url, pageNum) {
  if (!url || pageNum <= 1) return url
  const [base, query = ''] = url.split('?')
  const params = new URLSearchParams(query)
  params.set('page', String(pageNum))
  return `${base}?${params.toString()}`
}

/** Drop duplicate rows (same id) while keeping the first occurrence. */
function dedupeReviews(reviews) {
  const seen = new Set()
  const out = []
  for (const review of reviews) {
    const key = review && review.id
    if (!key || seen.has(key)) continue
    seen.add(key)
    out.push(review)
  }
  return out
}

function toInt(value) {
  if (value == null) return null
  const n = parseInt(String(value).replace(/[^0-9]/g, ''), 10)
  return Number.isFinite(n) ? n : null
}

/**
 * Parse the PRODUCT header of a TripAdvisor product page, e.g.
 *   "4.9 of 5 bubbles(595 reviews)" + "Excellent548Good33Average5Poor2Terrible7".
 * Never falls back to the operator aggregate (the page also shows an
 * operator-level total like "938 reviews" further down) — when the product
 * block is missing we return nulls so the UI can fall back to scraped rows.
 */
function parseTripAdvisorProductHeader(text) {
  if (!text) return { rating: null, reviewCount: null, distribution: null }

  let reviewCount = null
  let rating = null

  // Current markup: the review badge reads "4.9 (595 reviews) Superb • 97%…".
  const badge = text.match(/([\d.]+)\s*\(([\d,]+)\s+reviews?\)/i)
  if (badge) {
    rating = Number(badge[1])
    reviewCount = toInt(badge[2])
  }

  if (reviewCount == null) {
    const productBlock = text.match(/of 5 bubbles\s*\(([\d,]+)\s+reviews?\)/i)
    if (productBlock) reviewCount = toInt(productBlock[1])
  }
  if (rating == null) {
    const ratingMatch = text.match(/([\d.]+)\s+of 5 bubbles/i)
    if (ratingMatch) rating = Number(ratingMatch[1])
  }

  let distribution = null
  const labels = { excellent: 5, good: 4, average: 3, poor: 2, terrible: 1 }
  const parsed = {}
  for (const [label, stars] of Object.entries(labels)) {
    const match = text.match(new RegExp(`${label}\\s*([\\d,]+)`, 'i'))
    if (match) parsed[stars] = toInt(match[1])
  }
  if (Object.keys(parsed).length >= 3) distribution = parsed

  return {
    rating: rating != null && Number.isFinite(rating) ? rating : null,
    reviewCount,
    distribution,
  }
}

/**
 * Parse the product header of a GetYourGuide activity page. GYG blocks
 * non-browser fetches, so this stays best-effort: the header shows the
 * activity rating followed by its review count ("4.8 (293 reviews)").
 * Returns nulls when nothing product-level can be identified.
 */
function parseGetYourGuideProductHeader(text) {
  if (!text) return { rating: null, reviewCount: null, distribution: null }
  const match = text.match(/([\d.]+)\s*\(?\s*([\d,]+)\s+reviews?\)?/i)
  return {
    rating: match ? Number(match[1]) : null,
    reviewCount: match ? toInt(match[2]) : null,
    distribution: null,
  }
}

/**
 * Storefront policy: 1★ reviews are never stored for TripAdvisor /
 * GetYourGuide (Google has its own ≤3★ filter in the scraper).
 */
function excludeOneStarReviews(reviews) {
  return reviews.filter((review) => !(review.source !== 'GOOGLE' && Number(review.rating) <= 1))
}

/**
 * Remove the 1★ bucket from a scraped product header so the official totals
 * we store/count no longer include those reviews. Recomputes the rating from
 * the adjusted distribution (only possible when the platform exposes one).
 */
function excludeOneStarFromProductHeader(header) {
  if (!header || !header.distribution) return header
  const oneStar = Number(header.distribution['1'] || header.distribution[1] || 0)
  if (!oneStar) return header

  const distribution = { ...header.distribution }
  delete distribution['1']
  delete distribution[1]

  const count = Math.max(0, (header.reviewCount || 0) - oneStar)
  let sum = 0
  let total = 0
  for (const [star, value] of Object.entries(distribution)) {
    sum += Number(star) * Number(value)
    total += Number(value)
  }
  const rating = count > 0 && total > 0
    ? Math.round((sum / total) * 10) / 10
    : header.rating

  return { ...header, reviewCount: count, rating, distribution }
}

/** Slug used to key products in the generated dataset. */
function productIdFrom(source, url) {
  const match = url && url.match(/-d(\d+)-/)
  const raw = match ? match[1] : String(url || '').split('/').filter(Boolean).pop() || 'unknown'
  return `${String(source).toLowerCase()}-${String(raw).replace(/[^a-z0-9-]+/gi, '-')}`
}

module.exports = {
  buildTripAdvisorPageUrl,
  buildGetYourGuidePageUrl,
  dedupeReviews,
  parseTripAdvisorProductHeader,
  parseGetYourGuideProductHeader,
  excludeOneStarReviews,
  excludeOneStarFromProductHeader,
  productIdFrom,
}
