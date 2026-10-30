import { useMemo } from 'react'
import { useExpeditionTours } from './useExpeditionTours'
import { resolveReviewTitleMatches, type ReviewMatch, type ReviewTourSource } from '../lib/reviewRail'

/**
 * Resolve every review title on screen to a tour (link + artwork).
 *
 * The catalogue is fetched once and shared through react-query; resolution is
 * keyed by title, so a page of 20 reviews sharing one listing title runs one
 * match. Missing entries mean "no confident match" — callers then decide
 * between the destination fallback and no CTA at all.
 */
export function useReviewTourMatches(
  reviews: ReviewTourSource[] | undefined,
): Map<string, ReviewMatch> {
  const { data } = useExpeditionTours({ limit: 50 })
  const tours = data?.tours

  return useMemo(
    () => resolveReviewTitleMatches(reviews ?? [], tours ?? []),
    [reviews, tours],
  )
}
