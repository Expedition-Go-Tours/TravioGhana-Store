import { useSearchParams, useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import { ArrowLeft } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { fetchWithAuth } from '../lib/api'
import { mapRawTourToListing, type TourCardData } from '../hooks/useExpeditionTours'
import { mergeOffersIntoTours } from '../hooks/useHomepageSections'
import { usePlaceResolve } from '../hooks/usePlaceResolve'
import TourCard from '../components/TourCard'
import SearchContextChip from '../components/SearchContextChip'
import NoToursEmptyState from '../components/NoToursEmptyState'
import Footer from '../components/Footer'
import SEO from '../components/SEO'
import './SearchResultsPage.css'

async function fetchSearchResults(query: string): Promise<TourCardData[]> {
  const params = new URLSearchParams({ search: query, limit: '50' })
  const res = await fetchWithAuth(`/tours?${params.toString()}`)
  if (!res.ok) return []
  const payload = await res.json().catch(() => ({}))
  const tours: any[] = payload.data?.tours ?? payload.tours ?? []
  return mergeOffersIntoTours(tours.map(mapRawTourToListing))
}

async function fetchPlaceResults(place: string): Promise<TourCardData[]> {
  const params = new URLSearchParams({ place, limit: '50' })
  const res = await fetchWithAuth(`/tours?${params.toString()}`)
  if (!res.ok) return []
  const payload = await res.json().catch(() => ({}))
  const tours: any[] = payload.data?.tours ?? payload.tours ?? []
  return mergeOffersIntoTours(tours.map(mapRawTourToListing))
}

async function fetchAttractionResults(attraction: string, place: string): Promise<TourCardData[]> {
  // Use search-fallback for attraction queries
  const params = new URLSearchParams({ q: attraction, attraction, limit: '50' })
  if (place) params.set('place', place)
  const res = await fetchWithAuth(`/tours/search-fallback?${params.toString()}`)
  if (!res.ok) return []
  const payload = await res.json().catch(() => ({}))
  const recommended: any[] = payload.data?.recommended ?? []
  return mergeOffersIntoTours(recommended.map(mapRawTourToListing))
}

export default function SearchResultsPage() {
  const { t } = useTranslation()
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const query = searchParams.get('q')?.trim() ?? searchParams.get('place')?.trim() ?? ''
  const attractionParam = searchParams.get('attraction')?.trim() ?? ''
  const placeParam = searchParams.get('place')?.trim() ?? ''

  // Resolve the query to a place first
  const { data: place, isFetching: isResolvingPlace } = usePlaceResolve(query, 'expedition')
  const isPlace = !!place

  const isAttractionSearch = !!attractionParam

  const { data: tours = [], isLoading } = useQuery({
    queryKey: ['search-results', query, isAttractionSearch ? `attraction:${attractionParam}` : isPlace ? place?.name ?? '' : 'text'],
    queryFn: () => {
      if (isAttractionSearch) return fetchAttractionResults(attractionParam, placeParam)
      if (isPlace) return fetchPlaceResults(place!.name)
      return fetchSearchResults(query)
    },
    enabled: (query.length >= 2 || isAttractionSearch) && !isResolvingPlace,
    staleTime: 30_000,
  })

  const placeLabel = place?.displayName || place?.name || query
  const showLoading = isLoading || (isResolvingPlace && query.length >= 2)

  const resolvedName = isAttractionSearch
    ? attractionParam
    : place?.displayName || place?.name || query

  return (
    <div className="search-results-page">
      {/* robots.txt already disallows /search; the tag covers crawlers
          that ignore robots.txt, which can still read noindex. */}
      <SEO title="Search" robots="noindex, follow" />
      <div className="search-results-header">
        <button className="search-results-back" onClick={() => navigate(-1)}>
          <ArrowLeft size={20} />
        </button>
        <h1 className="search-results-title">
          {isAttractionSearch ? (
            t('search.toursVisiting', {
              attraction: attractionParam,
              defaultValue: 'Tours visiting {{attraction}}',
            })
          ) : query ? (
            isPlace ? (
              t('search.resultsIn', { location: placeLabel, defaultValue: 'Experiences in {{location}}' })
            ) : (
              <>
                {t('search.resultsFor', { defaultValue: 'Results for' })}{' '}
                <span className="search-results-query">"{query}"</span>
              </>
            )
          ) : (
            t('search.title', { defaultValue: 'Search Tours' })
          )}
        </h1>
        {tours.length > 0 && (
          <span className="search-results-count">
            {tours.length} {tours.length === 1 ? 'tour' : 'tours'} {t('search.toursFound', { defaultValue: 'found' })}
          </span>
        )}
      </div>

      <SearchContextChip
        suggestion={resolvedName && !showLoading && tours.length > 0 ? {
          id: isAttractionSearch ? `attr-${attractionParam}` : `place-${resolvedName}`,
          kind: isAttractionSearch ? 'attraction' : 'place',
          name: resolvedName,
          subtitle: '',
          meta: '',
          icon: isAttractionSearch ? '📍' : '🏙️',
          badge: isAttractionSearch ? 'Attraction' : 'Destination',
          score: 985,
          region: placeParam || undefined,
        } : null}
      />

      <div className="search-results-body">
        {showLoading ? (
          <div className="search-results-grid">
            {[0, 1, 2, 3, 4, 5].map((i) => (
              <div className="search-results-skeleton" key={i}>
                <div className="search-skeleton-img" />
                <div className="search-skeleton-lines">
                  <div className="search-skeleton-line" />
                  <div className="search-skeleton-line" />
                </div>
              </div>
            ))}
          </div>
        ) : tours.length > 0 ? (
          <div className="search-results-grid">
            {tours.map((tour, idx) => (
              <motion.div
                key={tour.id}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.25, delay: Math.min(idx * 0.04, 0.6) }}
              >
                <TourCard {...tour} />
              </motion.div>
            ))}
          </div>
        ) : (
          <NoToursEmptyState
            location={isAttractionSearch ? attractionParam : query}
            attraction={attractionParam}
            region={placeParam}
            onBrowseAll={() => navigate('/tours')}
          />
        )}
      </div>
      <Footer />
    </div>
  )
}
