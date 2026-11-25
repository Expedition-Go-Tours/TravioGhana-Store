import { Link, useLocation } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { heroVariantFromPath } from '../lib/heroVertical'
import './VerticalSwitch.css'

const OPTIONS = [
  { id: 'tours', to: '/', labelKey: 'hero.verticalTours', label: 'Tours & Activities' },
  { id: 'restaurants', to: '/restaurants', labelKey: 'hero.verticalRestaurants', label: 'Restaurants' },
] as const

/**
 * Route-driven choice between the two storefront verticals. Links, rather than
 * local state, keep each vertical's URL shareable and let the catalogue's
 * filters and SEO work from a real address.
 */
export default function VerticalSwitch() {
  const { t } = useTranslation()
  const { pathname } = useLocation()
  const active = heroVariantFromPath(pathname)

  return (
    <div
      className="vertical-switch"
      role="group"
      aria-label={t('hero.verticalSwitchLabel', { defaultValue: 'Browse by category' })}
    >
      {OPTIONS.map((option) => {
        const isActive = active === option.id
        return (
          <Link
            key={option.id}
            to={option.to}
            className={`vertical-switch__option${isActive ? ' vertical-switch__option--active' : ''}`}
            aria-current={isActive ? 'page' : undefined}
          >
            {t(option.labelKey, { defaultValue: option.label })}
          </Link>
        )
      })}
    </div>
  )
}
