import { matchTourForTitle, type MatchableTour } from './reviewTourLink'
import { tourPath } from './tourPath'
import { isScrapedReviewSupplier } from './supplierIdentity'

/**
 * Turning a scraped review into a card.
 *
 * The review rows carry no artwork and no link to *our* catalogue — only the
 * platform's listing title. Both are resolved here by the same title matcher
 * the rest of the app uses, with the supplier gate failing closed: another
 * operator's tour must never supply the photo or receive the click.
 */

export interface ReviewMatch {
  /** Tour photo for the card head. Null → render the neutral placeholder. */
  image: string | null
  /** Specific tour detail page (`/tour/{id}/{slug}`). Null → caller falls back. */
  href: string | null
}

export interface ReviewTourSource {
  id: string
  tourTitle: string
  /** Present on newer rows; used as-is when the scraper captured it. */
  tourThumbnail?: string | null
}

export interface MatchableCardTour extends MatchableTour {
  id?: string | null
  slug?: string | null
  category?: string | null
  image?: string | null
  photos?: string[]
}

/** review id → card artwork + CTA target. */
export function resolveReviewMatches(
  reviews: ReviewTourSource[],
  tours: MatchableCardTour[],
): Map<string, ReviewMatch> {
  const map = new Map<string, ReviewMatch>()
  // "Transport form Accra to Cape Coast" shares every distinctive token with a
  // Cape Coast day tour, so the matcher hands it back for those reviews. A
  // transfer is not the experience the review is about — never link it.
  const catalogue = tours.filter((tour) => String(tour.category || '').toLowerCase() !== 'transport')

  for (const review of reviews) {
    const match = matchTourForTitle(review.tourTitle, catalogue)
    const eligible = match && isScrapedReviewSupplier(match.supplierName) ? match : null

    const image = review.tourThumbnail || eligible?.image || eligible?.photos?.[0] || null
    const href = eligible ? tourPath(eligible.id, eligible.slug) : null

    if (image || href) map.set(review.id, { image, href })
  }

  return map
}

/**
 * One card per tour.
 *
 * The featured slice is chosen for review quality, not variety — at the time of
 * writing, 16 reviews covered only 5 tours (one tour had 8). Rendering them in
 * order produced the same tour, photo and experience eight times in a row. The
 * rail keeps the first (best) review per tour so the wall looks like a wall of
 * different experiences, while all 1,200+ reviews stay reachable via "View all".
 */
export function selectDistinctReviews<T extends { tourTitle: string }>(reviews: T[]): T[] {
  const seen = new Set<string>()
  const out: T[] = []
  for (const review of reviews) {
    const key = review.tourTitle.trim().toLowerCase().replace(/\s+/g, ' ')
    if (!key || seen.has(key)) continue
    seen.add(key)
    out.push(review)
  }
  return out
}
