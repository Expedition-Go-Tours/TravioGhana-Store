import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import TopRecommendationsSlider from './TopRecommendationsSlider'
import {
  dedupeTours,
  toTopRecItem,
  TOP_RECOMMENDATION_COUNT,
  type TopRecItem,
} from './TopRecommendationsGrid'
import { useTourDescriptionsByIds } from '../hooks/useTourDescriptions'
import type { HomepageTour, HomepageBackfill } from '../hooks/useHomepageSections'
import './TopRecommendationsSection.css'

interface Props {
  /** Backend-ranked "recommended" rows (great reviews + booking momentum). */
  preloaded?: HomepageTour[]
  /** Nearby rail when the payload is location-scoped. */
  backfill?: HomepageBackfill | null
  /** Booking/view/wishlist momentum — tops up the 10 when recommended caps at 9. */
  trending?: HomepageTour[]
  /** Bayesian-smoothed quality — further top-up source. */
  topRated?: HomepageTour[]
  isLoading?: boolean
  title?: string
}

/**
 * "Our top recommendations for things to do in Ghana" — the homepage rail:
 * ten tours in a paged slider (five per view on wide screens). The rows come
 * from the homepage's already-fetched ranked slices — the backend
 * "recommended" ranking first (quality + bookings), then the nearby rail,
 * momentum and quality slices if it ships fewer than ten. Descriptions are
 * fetched per id from the tour detail endpoint (see useTourDescriptionsByIds);
 * a tour whose description is unavailable still renders, just without an
 * excerpt.
 *
 * The All Tours "Top Recommendations" view keeps its own grid
 * (TopRecommendationsGrid, cards layout) over the same tours; "View all"
 * opens that filtered listing.
 */
export default function TopRecommendationsSection({
  preloaded,
  backfill,
  trending,
  topRated,
  isLoading,
  title,
}: Props) {
  const { t } = useTranslation()

  const items = useMemo<TopRecItem[]>(
    () =>
      dedupeTours([
        ...(preloaded ?? []),
        ...(backfill?.tours ?? []),
        ...(trending ?? []),
        ...(topRated ?? []),
      ])
        .slice(0, TOP_RECOMMENDATION_COUNT)
        .map(toTopRecItem),
    [preloaded, backfill, trending, topRated],
  )

  const descriptions = useTourDescriptionsByIds(
    useMemo(() => items.map((item) => item.id), [items]),
    items.length > 0,
  )

  if (items.length === 0 && !isLoading) return null

  return (
    <section className="top-recs" aria-label={title || t('sections.topRecommendations')}>
      <div className="top-recs-container">
        <TopRecommendationsSlider
          items={items}
          descriptions={descriptions}
          title={title || t('sections.topRecommendations')}
          isLoading={isLoading && items.length === 0}
        />
      </div>
    </section>
  )
}
