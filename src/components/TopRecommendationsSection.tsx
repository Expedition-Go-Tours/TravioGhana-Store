import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import OptimizedImage from '@/components/shared/OptimizedImage'
import { useTourDescriptions, type TourCatalogItem } from '../hooks/useTourDescriptions'
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
  /** Paragraphs joined with `\n` (see useTourDescriptions). */
  description: string
}

function toItem(tour: HomepageTour): TopRecItem {
  return {
    id: tour.id,
    title: tour.title,
    slug: tour.slug,
    image: tour.coverPhoto || tour.photos?.[0] || '',
    description: '',
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
 * tour's detail page), a clamped description excerpt, and an inline
 * "See more" / "See less" toggle that reveals the full description in place.
 */
function TopRecommendationItem({ item }: { item: TopRecItem }) {
  const { t } = useTranslation()
  const [expanded, setExpanded] = useState(false)

  const href = tourPath(item.id, item.slug)
  const paragraphs = item.description
    .split('\n')
    .map((paragraph) => paragraph.trim())
    .filter(Boolean)
  const longDescription = item.description.length > LONG_DESCRIPTION_CHARS

  return (
    <article className="top-rec-item">
      <div className="top-rec-image">
        {item.image ? (
          <OptimizedImage src={item.image} alt="" width={640} className="top-rec-img" />
        ) : (
          <span className="top-rec-image-fallback" />
        )}
      </div>
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
 * quality slices if it ships fewer than ten. Descriptions are joined by id
 * from the catalogue (see useTourDescriptions); when one is missing the
 * excerpt is simply omitted.
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

  const hasPayloadRows = (preloaded?.length ?? 0) > 0
  const { data: catalog = [] } = useTourDescriptions(hasPayloadRows || !!isLoading)

  const items = useMemo<TopRecItem[]>(() => {
    const descriptionById = new Map(catalog.map((row) => [row.id, row.description]))
    const withDescription = (tour: HomepageTour): TopRecItem => {
      const item = toItem(tour)
      return { ...item, description: descriptionById.get(item.id) ?? '' }
    }

    const preferred = dedupe([
      ...(preloaded ?? []),
      ...(backfill?.tours ?? []),
      ...(trending ?? []),
      ...(topRated ?? []),
    ]).map(withDescription)

    if (preferred.length >= RECOMMENDATION_COUNT) {
      return preferred.slice(0, RECOMMENDATION_COUNT)
    }

    // Last resort: fill the grid from the catalogue already fetched for the
    // descriptions, so the section still shows ten rows whenever the
    // catalogue has enough tours.
    const seen = new Set(preferred.map((item) => item.id))
    const filler: TourCatalogItem[] = catalog
      .filter((row) => !seen.has(row.id))
      .slice(0, RECOMMENDATION_COUNT - preferred.length)
    return [...preferred, ...filler]
  }, [preloaded, backfill, trending, topRated, catalog])

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
            <TopRecommendationItem item={item} key={item.id} />
          ))}
        </div>
      </div>
    </section>
  )
}
