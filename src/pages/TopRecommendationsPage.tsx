import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { useLocationSearch } from '../context/LocationSearchContext'
import { useHomepage, useHomepageByCity } from '../hooks/useHomepageSections'
import { useTourDescriptionsByIds } from '../hooks/useTourDescriptions'
import TopRecommendationsGrid, {
  dedupeTours,
  toTopRecItem,
  TOP_RECOMMENDATION_COUNT,
  type TopRecItem,
} from '../components/TopRecommendationsGrid'
import Footer from '../components/Footer'
import SEO, { buildBreadcrumbSchema, SITE_URL } from '../components/SEO'
import './TopRecommendationsPage.css'

/**
 * /top-recommendations — the "View all" page for the homepage's top
 * recommendations section. It renders the same ten cards the section shows,
 * in the same order, via the shared TopRecommendationsGrid: the section's
 * ranked slices (recommended, then the nearby rail, trending and top-rated
 * top-ups) deduped and capped at ten.
 *
 * The payload selection mirrors HomePage exactly — the city-scoped homepage
 * when a location search is active, the global one otherwise — so the cards
 * here are literally the cards the section displayed. The aggregate homepage
 * query is react-query cached (5 minutes), so arriving from the homepage
 * paints the same rows without a new request.
 */
export default function TopRecommendationsPage() {
  const { t } = useTranslation()
  const { currentLocation, hasActiveSearch } = useLocationSearch()
  const { data: homepage, isLoading } = useHomepage({ enabled: !hasActiveSearch })
  const { data: cityHomepage, isLoading: isCityLoading, isError: isCityError } = useHomepageByCity(currentLocation)

  // Same selection HomePage makes: city-scoped while a location search is
  // active, falling back to the global payload on error.
  const data = hasActiveSearch && !isCityError ? (cityHomepage ?? homepage) : homepage
  const loading = hasActiveSearch ? isCityLoading : isLoading

  const items = useMemo<TopRecItem[]>(
    () =>
      dedupeTours([
        ...(data?.recommended ?? []),
        ...(data?.recommendedBackfill?.tours ?? []),
        ...(data?.trending ?? []),
        ...(data?.topRated ?? []),
      ])
        .slice(0, TOP_RECOMMENDATION_COUNT)
        .map(toTopRecItem),
    [data],
  )

  const descriptions = useTourDescriptionsByIds(
    useMemo(() => items.map((item) => item.id), [items]),
    items.length > 0,
  )

  return (
    <div className="top-recs-page">
      {/* Matches the prerendered /top-recommendations copy the crawlers receive. */}
      <SEO
        title="Top Recommendations | Things to Do in Ghana"
        description="Our top recommendations for things to do in Ghana — hand-picked tours and experiences ranked by traveller reviews and booking momentum."
        keywords="things to do in Ghana, top Ghana tours, recommended Ghana experiences, best tours Ghana"
        jsonLd={buildBreadcrumbSchema([
          { name: 'Home', url: `${SITE_URL}/` },
          { name: 'Top Recommendations', url: `${SITE_URL}/top-recommendations` },
        ])}
      />
      <div className="top-recs-page-container">
        <h1 className="top-recs-page-title">{t('sections.topRecommendations')}</h1>
        <TopRecommendationsGrid items={items} descriptions={descriptions} isLoading={loading} />
      </div>
      <Footer />
    </div>
  )
}
