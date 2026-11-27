import { Link, useLocation } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { BedDouble, Route, UtensilsCrossed, type LucideIcon } from 'lucide-react'
import { heroVariantFromPath } from '../lib/heroVertical'
import { prepareVerticalSwitch } from '../lib/useVerticalScrollReset'
import './VerticalSwitch.css'

interface VerticalOption {
  id: string
  to?: string
  labelKey: string
  label: string
  icon: LucideIcon
  comingSoon?: boolean
}

/**
 * "Tours & Activities" uses a route glyph rather than a compass: a journey
 * reads as a guided tour/itinerary and never gets mistaken for navigation,
 * which the location pin already covers.
 */
const OPTIONS: VerticalOption[] = [
  { id: 'tours', to: '/', labelKey: 'hero.verticalTours', label: 'Tours & Activities', icon: Route },
  { id: 'restaurants', to: '/restaurants', labelKey: 'hero.verticalRestaurants', label: 'Restaurants', icon: UtensilsCrossed },
  { id: 'hotels', labelKey: 'hero.verticalHotels', label: 'Hotels & Accommodations', icon: BedDouble, comingSoon: true },
]

interface VerticalSwitchProps {
  /** 'pill' (default) is the compact text switch; 'hero' adds icons + the coming-soon hotel tab. */
  variant?: 'pill' | 'hero'
}

/**
 * Route-driven choice between the storefront verticals. Links, rather than
 * local state, keep each vertical's URL shareable and let the catalogue's
 * filters and SEO work from a real address. Switching replaces the history
 * entry (tabs do not stack); both pages are in the initial bundle so there is
 * no Suspense fallback on the tab change.
 */
export default function VerticalSwitch({ variant = 'pill' }: VerticalSwitchProps) {
  const { t } = useTranslation()
  const { pathname } = useLocation()
  const active = heroVariantFromPath(pathname)
  const isHero = variant === 'hero'
  const options = isHero ? OPTIONS : OPTIONS.filter((option) => !option.comingSoon)

  return (
    <div
      className={`vertical-switch${isHero ? ' vertical-switch--hero' : ''}`}
      role="group"
      aria-label={t('hero.verticalSwitchLabel', { defaultValue: 'Browse by category' })}
    >
      {options.map((option) => {
        const Icon = option.icon
        const isActive = !option.comingSoon && active === option.id

        if (option.comingSoon) {
          return (
            <span
              key={option.id}
              className="vertical-switch__option vertical-switch__option--soon"
              aria-disabled="true"
              title={t('hero.verticalSoon', { defaultValue: 'Coming soon' })}
            >
              <Icon className="vertical-switch__icon" size={isHero ? 22 : 16} aria-hidden="true" />
              <span className="vertical-switch__label">
                {t(option.labelKey, { defaultValue: option.label })}
              </span>
              <span className="vertical-switch__soon-badge">
                {t('hero.verticalSoon', { defaultValue: 'Soon' })}
              </span>
            </span>
          )
        }

        return (
          <Link
            key={option.id}
            to={option.to as string}
            replace
            className={`vertical-switch__option${isActive ? ' vertical-switch__option--active' : ''}`}
            aria-current={isActive ? 'page' : undefined}
            onClick={(event) => {
              // Let the browser handle new-tab / modified clicks as usual.
              if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return
              prepareVerticalSwitch()
            }}
          >
            <Icon className="vertical-switch__icon" size={isHero ? 22 : 16} aria-hidden="true" />
            {isHero ? (
              <span className="vertical-switch__label">
                {t(option.labelKey, { defaultValue: option.label })}
              </span>
            ) : (
              t(option.labelKey, { defaultValue: option.label })
            )}
          </Link>
        )
      })}
    </div>
  )
}
