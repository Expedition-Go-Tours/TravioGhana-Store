import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import type { TourDetail } from '../../lib/tourTypes'
import './Breadcrumb.css'

interface BreadcrumbProps {
  tour: TourDetail
}

export default function Breadcrumb({ tour }: BreadcrumbProps) {
  const { t } = useTranslation()
  const breadcrumbs = [
    { label: t('breadcrumb.home'), path: '/' },
    { label: tour.location.split(',')[1]?.trim() || 'Tours', path: '/tours' },
    { label: tour.title, path: null },
  ]

  return (
    <nav className="breadcrumb" aria-label="Breadcrumb">
      <ol className="breadcrumb-list">
        {breadcrumbs.map((crumb, index) => (
          <li key={index} className="breadcrumb-item">
            {crumb.path ? (
              <>
                <Link to={crumb.path} className="breadcrumb-link">
                  {crumb.label}
                </Link>
                {index < breadcrumbs.length - 1 && (
                  <svg 
                    className="breadcrumb-separator" 
                    width="16" 
                    height="16" 
                    viewBox="0 0 24 24" 
                    fill="none" 
                    stroke="currentColor" 
                    strokeWidth="2"
                  >
                    <polyline points="9 18 15 12 9 6" />
                  </svg>
                )}
              </>
            ) : (
              <span className="breadcrumb-current">{crumb.label}</span>
            )}
          </li>
        ))}
      </ol>
    </nav>
  )
}
