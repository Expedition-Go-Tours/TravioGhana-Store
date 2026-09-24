import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import './Breadcrumb.css'

interface BreadcrumbProps {
  tour: { title: string; location?: string }
}

export default function Breadcrumb({ tour }: BreadcrumbProps) {
  const { t } = useTranslation()

  // `location` is "<City>, <Country>" — the city is the crumb we want (and the
  // one the SEO block links to). Using index 1 here rendered the country.
  const city = tour.location?.split(',')[0]?.trim() || ''

  const breadcrumbs = [
    { label: t('breadcrumb.home'), path: '/' },
    {
      label: city || t('breadcrumb.tours', 'Tours'),
      path: city ? `/tours?place=${encodeURIComponent(city)}` : '/tours',
    },
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
