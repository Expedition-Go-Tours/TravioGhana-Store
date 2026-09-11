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
import NoToursEmptyState from '../components/NoToursEmptyState'
import Footer from '../components/Footer'
import './SearchResultsPage.css'

async function fetchSearchResults(query: string): Promise<TourCardData[]> {
  const params = new URLSearchParams({ search: query, limit: '50' })
  const res = await fetchWithAuth(`/tours?${params.toString()}`)
  if (!res.ok) return []
  const payload = await res.json().catch(() => ({}))
  const tours: any[] = payload.data?.tours ?? payload.tours ?? []
  return mergeOffersIntoTours(tours.map(mapRawTourToListing))
}

/**
 * Place-scoped listing — the GYG behaviour. When the query resolves to a city
 * or attraction, the backend orders every tour around it (in the place ->
 * near it -> the rest, popularity within each band) and never filters, so a
 * location search can't dead-end.
 */
async function fetchPlaceResults(place: string): Promise<TourCardData[]> {
  const params = new URLSearchParams({ place, limit: '50' })
  const res = await fetchWithAuth(`/tours?${params.toString()}`)
  if (!res.ok) return []
  const payload = await res.json().catch(() => ({}))
  const tours: any[] = payload.data?.tours ?? payload.tours ?? []
  return mergeOffersIntoTours(tours.map(mapRawTourToListing))
}

export default function SearchResultsPage() {
  const { t } = useTranslation()
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const query = searchParams.get('q')?.trim() ?? ''

  // Resolve the query to a place first: if it is one (city / attraction), scope
  // the listing to it; otherwise keep the plain text-relevance search.
  const { data: place, isFetching: isResolvingPlace } = usePlaceResolve(query, 'expedition')
  const isPlace = !!place

  const { data: tours = [], isLoading } = useQuery({
    queryKey: ['search-results', query, isPlace ? place?.name ?? '' : 'text'],
    queryFn: () => (isPlace ? fetchPlaceResults(place!.name) : fetchSearchResults(query)),
    enabled: query.length >= 2 && !isResolvingPlace,
    staleTime: 30_000,
  })

  const placeLabel = place?.displayName || place?.name || query
  const showLoading = isLoading || (isResolvingPlace && query.length >= 2)

  return (
    <div className="search-results-page">
      <div className="search-results-header">
        <button className="search-results-back" onClick={() => navigate(-1)}>
          <ArrowLeft size={20} />
        </button>
        <h1 className="search-results-title">
          {query ? (
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
          <NoToursEmptyState location={query} onBrowseAll={() => navigate('/tours')} />
        )}
      </div>
      <Footer />
    </div>
  )
}
