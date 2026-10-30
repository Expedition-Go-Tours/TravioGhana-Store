import { normalizeTitle, scoreTourTitle, type MatchableTour } from './reviewTourLink'
import { tourPath } from './tourPath'
import { isScrapedReviewSupplier } from './supplierIdentity'

/**
 * Turning a scraped review into a card.
 *
 * The rows carry no artwork and no link to *our* catalogue — only the
 * platform's listing title. The title is resolved once, against the whole
 * catalogue, and the result is reused by every card that shares it: 1,248
 * review rows currently share 11 titles.
 */

export interface ReviewMatch {
  /** Tour photo for the card head. Null → render the neutral placeholder. */
  image: string | null
  /** Specific tour detail page (`/tour/{id}/{slug}`). Null when unresolved. */
  href: string | null
  /**
   * What the CTA should do when there is no specific tour:
   *   tour    — a catalogue tour was identified
   *   listing — unresolved, fall back to the destination listing
   *   none    — the review is about a transfer / non-experience: no CTA
   */
  cta: 'tour' | 'listing' | 'none'
}

export interface ReviewTourSource {
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

/**
 * Platform titles that our token matcher cannot recognise on its own because
 * the wording collides with another listing. Keys are normalized titles.
 */
const REVIEW_TITLE_ALIASES: Record<string, string> = {
  // Loses every token vote to "Transport form Accra to Cape Coast"; it is the
  // Cape Coast day tour, not a transfer.
  'from accra the cape coast day tour guided experience':
    'Cape Coast Castle, Elmina Castle & Kakum National Park Tour',
}

/** Stable map key for a review's listing title. */
export function reviewTitleKey(title: string): string {
  return normalizeTitle(title)
}

const isTransport = (tour: MatchableCardTour) =>
  String(tour.category || '').toLowerCase() === 'transport'

/** review-title-key → card artwork, CTA target and CTA behaviour. */
export function resolveReviewTitleMatches(
  reviews: ReviewTourSource[],
  tours: MatchableCardTour[],
): Map<string, ReviewMatch> {
  const map = new Map<string, ReviewMatch>()

  // Transfers share every distinctive token with real tours ("Transport form
  // Accra to Cape Coast" vs a Cape Coast day tour) and win the match, so they
  // are only ever consulted to *recognise* a transfer, never to link one.
  const catalogue = tours.filter((tour) => !isTransport(tour))
  const transfers = tours.filter(isTransport)

  for (const review of reviews) {
    const key = reviewTitleKey(review.tourTitle)
    if (!key || map.has(key)) continue

    const query = REVIEW_TITLE_ALIASES[key] ?? review.tourTitle

    // 0.5 is the first score produced by real title-token overlap (the
    // attraction-keyword fallback tops out at 0.35). Below it the "match" is
    // only a shared destination word and must not own the CTA.
    let best: { tour: MatchableCardTour; score: number } | null = null
    for (const tour of catalogue) {
      const score = scoreTourTitle(query, tour)
      if (score > 0 && (!best || score > best.score)) best = { tour, score }
    }

    // Transfers share the destination tokens with real tours, so whichever
    // title fits better decides: "Transport form Accra to Cape Coast" is a
    // transfer (no experience page), while "Cape Coast Castle … Day Tour" is
    // the tour.
    let bestTransfer: { score: number } | null = null
    for (const transfer of transfers) {
      const score = scoreTourTitle(review.tourTitle, transfer)
      if (score > 0 && (!bestTransfer || score > bestTransfer.score)) bestTransfer = { score }
    }

    if (bestTransfer && bestTransfer.score >= 0.5 && (!best || bestTransfer.score >= best.score)) {
      map.set(key, { image: review.tourThumbnail || null, href: null, cta: 'none' })
      continue
    }

    const eligible = best && best.score >= 0.5 && isScrapedReviewSupplier(best.tour.supplierName)
      ? best.tour
      : null

    if (eligible) {
      map.set(key, {
        image: review.tourThumbnail || eligible.image || eligible.photos?.[0] || null,
        href: tourPath(eligible.id, eligible.slug),
        cta: 'tour',
      })
      continue
    }

    map.set(key, {
      image: review.tourThumbnail || null,
      href: null,
      cta: 'listing',
    })
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
    const key = reviewTitleKey(review.tourTitle)
    if (!key || seen.has(key)) continue
    seen.add(key)
    out.push(review)
  }
  return out
}
