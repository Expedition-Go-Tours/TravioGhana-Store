/**
 * Catch-all 404 page.
 *
 * Mounted on the `path="*"` route in App.tsx, below every explicit route.
 * It replaces the previous behaviour where any unmatched URL silently
 * rendered the homepage — which hid broken links from anyone auditing them.
 *
 * @see App.tsx (the route split)
 */
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Compass } from 'lucide-react'
import Footer from '../components/Footer'
import SEO from '../components/SEO'
import './NotFoundPage.css'

export default function NotFoundPage() {
  const { t } = useTranslation()

  const title = t('notFound.title', 'Page not found')
  const subtitle = t('notFound.subtitle', "The page you're looking for doesn't exist or has been moved.")

  return (
    <>
      <SEO title={title} description={subtitle} robots="noindex, follow" />
      <main className="notfound-page">
        <div className="notfound-inner">
          <span className="notfound-icon" aria-hidden="true">
            <Compass size={34} strokeWidth={1.8} />
          </span>
          <p className="notfound-code">404</p>
          <h1 className="notfound-title">{title}</h1>
          <p className="notfound-subtitle">{subtitle}</p>
          <Link to="/" className="notfound-cta">
            {t('notFound.cta', 'Back to homepage')}
          </Link>
        </div>
      </main>
      <Footer />
    </>
  )
}
