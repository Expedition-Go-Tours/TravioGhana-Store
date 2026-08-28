import { useSearchParams, useNavigate, Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import { ArrowLeft, Search } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { fetchWithAuth } from '../lib/api'
import { mapRawTourToListing, type TourCardData } from '../hooks/useExpeditionTours'
import { mergeOffersIntoTours } from '../hooks/useHomepageSections'
import TourCard from '../components/TourCard'
import './SearchResultsPage.css'

async function fetchSearchResults(query: string): Promise<TourCardData[]> {
  const params = new URLSearchParams({ search: query, limit: '50' })
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

  const { data: tours = [], isLoading } = useQuery({
    queryKey: ['search-results', query],
    queryFn: () => fetchSearchResults(query),
    enabled: query.length >= 2,
    staleTime: 30_000,
  })

  return (
    <div className="search-results-page">
      <div className="search-results-header">
        <button className="search-results-back" onClick={() => navigate(-1)}>
          <ArrowLeft size={20} />
        </button>
        <h1 className="search-results-title">
          {query ? (
            <>
              {t('search.resultsFor', { defaultValue: 'Results for' })}{' '}
              <span className="search-results-query">"{query}"</span>
            </>
          ) : (
            t('search.title', { defaultValue: 'Search Tours' })
          )}
        </h1>
        {tours.length > 0 && (
          <span className="search-results-count">
            {tours.length} {t('search.toursFound', { defaultValue: 'tours found' })}
          </span>
        )}
      </div>

      <div className="search-results-body">
        {isLoading ? (
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
          <div className="search-results-empty">
            <Search size={48} strokeWidth={1.5} />
            <h2>{t('search.noResults', { defaultValue: 'No tours found' })}</h2>
            <p>
              {t('search.noResultsHint', {
                defaultValue: 'Try a different search term or browse all tours.',
              })}
            </p>
            <Link to="/tours" className="search-results-browse-btn">
              {t('search.browseAll', { defaultValue: 'Browse All Tours' })}
            </Link>
          </div>
        )}
      </div>
    </div>
  )
}
