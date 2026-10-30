import { matchTourForTitle, type MatchableTour } from './reviewTourLink'
import { isScrapedReviewSupplier } from './supplierIdentity'

/**
 * Card artwork for the homepage review rail.
 *
 * The scraped review rows carry no artwork of their own
 * (`tourThumbnail` / `coverPhoto` are null on every row), so the rail borrows
 * the photo of the tour the review is about. Matching reuses the same title
 * matcher as the "View Experience" link, and the supplier gate fails closed:
 * a tour image must never be attached to another operator's review.
 */

export interface ThumbnailReview {
  id: string
  tourTitle: string
  /** Present on newer rows; used as-is when the scraper captured it. */
  tourThumbnail?: string | null
}

export interface ThumbnailTour extends MatchableTour {
  image?: string | null
  photos?: string[]
}

/** review id → image URL. Missing entries mean "render the placeholder". */
export function resolveReviewThumbnails(
  reviews: ThumbnailReview[],
  tours: ThumbnailTour[],
): Map<string, string> {  const map = new Map<string, string>()

  for (const review of reviews) {
    if (review.tourThumbnail) {
      map.set(review.id, review.tourThumbnail)
      continue
    }

    const match = matchTourForTitle(review.tourTitle, tours)
    if (!match || !isScrapedReviewSupplier(match.supplierName)) continue

    const image = match.image || match.photos?.[0]
    if (image) map.set(review.id, image)
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
