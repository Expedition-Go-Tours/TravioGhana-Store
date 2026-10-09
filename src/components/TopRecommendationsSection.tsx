import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import OptimizedImage from '@/components/shared/OptimizedImage'
import { useTourDescriptionsByIds } from '../hooks/useTourDescriptions'
import type { HomepageTour, HomepageBackfill } from '../hooks/useHomepageSections'
import { tourPath } from '../lib/tourPath'
import './TopRecommendationsSection.css'

/** Five rows of two — the editorial grid the image specifies. */
const RECOMMENDATION_COUNT = 10
/** Same long-description gate the tour detail page uses for its toggle. */
const LONG_DESCRIPTION_CHARS = 300

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

interface TopRecItem {
  id: string
  title: string
  slug: string
  image: string
}

function toItem(tour: HomepageTour): TopRecItem {
  return {
    id: tour.id,
    title: tour.title,
    slug: tour.slug,
    image: tour.coverPhoto || tour.photos?.[0] || '',
  }
}

/** Dedupe by id, first occurrence wins (payload order = backend ranking). */
function dedupe(tours: HomepageTour[]): HomepageTour[] {
  const seen = new Set<string>()
  const out: HomepageTour[] = []
  for (const tour of tours) {
    if (!tour?.id || seen.has(tour.id)) continue
    seen.add(tour.id)
    out.push(tour)
  }
  return out
}

/**
 * One recommendation row: image, title (the only link — it routes to the
 * tour's detail page), the description excerpt, and an inline "See more" /
 * "See less" toggle that reveals the full description in place.
 *
 * The text is the tour's full description from the detail endpoint (the same
 * source the tour detail page renders); the collapsed state simply clamps it
 * to three lines, and "See more" un-clamps the entire text.
 */
function TopRecommendationItem({ item, description }: { item: TopRecItem; description: string }) {
  const { t } = useTranslation()
  const [expanded, setExpanded] = useState(false)

  const paragraphs = description
    .split('\n')
    .map((paragraph) => paragraph.trim())
    .filter(Boolean)
  const longDescription = description.length > LONG_DESCRIPTION_CHARS
  const href = tourPath(item.id, item.slug)

  return (
    <article className={`top-rec-item${expanded ? ' top-rec-item--expanded' : ''}`}>
      <Link to={href} className="top-rec-image" aria-label={item.title}>
        {item.image ? (
          <OptimizedImage src={item.image} alt="" width={640} className="top-rec-img" />
        ) : (
          <span className="top-rec-image-fallback" />
        )}
      </Link>
      <div className="top-rec-body">
        <h3 className="top-rec-title">
          <Link to={href}>{item.title}</Link>
        </h3>
        {paragraphs.length > 0 &&
          (expanded && longDescription ? (
            paragraphs.map((paragraph, index) => (
              <p className="top-rec-excerpt" key={index}>
                {paragraph}
              </p>
            ))
          ) : (
            <p className="top-rec-excerpt top-rec-excerpt--clamped">{paragraphs.join(' ')}</p>
          ))}
        {longDescription && (
          <button
            type="button"
            className="top-rec-toggle"
            onClick={() => setExpanded((value) => !value)}
            aria-expanded={expanded}
          >
            {expanded ? t('tourDetail.seeLess') : t('tourDetail.seeMore')}
          </button>
        )}
      </div>
    </article>
  )
}

/**
 * "Our top recommendations for things to do in Ghana" — the bottom-of-page
 * editorial section: ten tours, five rows of two. The rows come from the
 * homepage's already-fetched ranked slices — the backend "recommended"
 * ranking first (quality + bookings), then the nearby rail, momentum and
 * quality slices if it ships fewer than ten. Descriptions are fetched per id
 * from the tour detail endpoint (see useTourDescriptionsByIds); a tour whose
 * description is unavailable still renders, just without an excerpt.
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
      dedupe([
        ...(preloaded ?? []),
        ...(backfill?.tours ?? []),
        ...(trending ?? []),
        ...(topRated ?? []),
      ])
        .slice(0, RECOMMENDATION_COUNT)
        .map(toItem),
    [preloaded, backfill, trending, topRated],
  )

  const descriptions = useTourDescriptionsByIds(
    useMemo(() => items.map((item) => item.id), [items]),
    items.length > 0,
  )

  if (items.length === 0) {
    if (!isLoading) return null
    return (
      <section className="top-recs" aria-label={t('sections.topRecommendations')}>
        <div className="top-recs-container">
          <div className="top-recs-grid" aria-hidden="true">
            {Array.from({ length: RECOMMENDATION_COUNT }).map((_, index) => (
              <div className="top-rec-item top-rec-item--skeleton" key={index}>
                <span className="top-rec-skeleton-image" />
                <div className="top-rec-body">
                  <span className="top-rec-skeleton-line top-rec-skeleton-line--title" />
                  <span className="top-rec-skeleton-line" />
                  <span className="top-rec-skeleton-line" />
                  <span className="top-rec-skeleton-line top-rec-skeleton-line--short" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>
    )
  }

  return (
    <section className="top-recs" aria-labelledby="top-recs-title">
      <div className="top-recs-container">
        <h2 id="top-recs-title" className="top-recs-title">
          {title || t('sections.topRecommendations')}
        </h2>
        <div className="top-recs-grid">
          {items.map((item) => (
            <TopRecommendationItem
              item={item}
              description={descriptions.get(item.id) ?? ''}
              key={item.id}
            />
          ))}
        </div>
      </div>
    </section>
  )
}
