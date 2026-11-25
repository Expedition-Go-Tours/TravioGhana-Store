import { Link, useLocation } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { heroVariantFromPath } from '../lib/heroVertical'
import { prepareVerticalSwitch } from '../lib/useVerticalScrollReset'
import './VerticalSwitch.css'

const OPTIONS = [
  { id: 'tours', to: '/', labelKey: 'hero.verticalTours', label: 'Tours & Activities' },
  { id: 'restaurants', to: '/restaurants', labelKey: 'hero.verticalRestaurants', label: 'Restaurants' },
] as const

/**
 * Route-driven choice between the two storefront verticals. Links, rather than
 * local state, keep each vertical's URL shareable and let the catalogue's
 * filters and SEO work from a real address. Switching replaces the history
 * entry (tabs do not stack); both pages are in the initial bundle so there is
 * no Suspense fallback on the tab change.
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
            replace
            className={`vertical-switch__option${isActive ? ' vertical-switch__option--active' : ''}`}
            aria-current={isActive ? 'page' : undefined}
            onClick={(event) => {
              // Let the browser handle new-tab / modified clicks as usual.
              if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return
              prepareVerticalSwitch()
            }}
          >
            {t(option.labelKey, { defaultValue: option.label })}
          </Link>
        )
      })}
    </div>
  )
}
