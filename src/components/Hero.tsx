import { useRef } from 'react'
import { useLocation } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import SearchBar from './SearchBar'
import VerticalSwitch from './VerticalSwitch'
import { heroVariantFromPath } from '../lib/heroVertical'
import './Hero.css'

const RESTAURANT_TITLE = 'Discover Your Next Favourite Table'
const RESTAURANT_SUBTITLE =
  'Reserve restaurants, rooftop spots and authentic local dining experiences.'

export default function Hero() {
  const { t } = useTranslation()
  const { pathname } = useLocation()
  const variant = heroVariantFromPath(pathname)
  const isRestaurants = variant === 'restaurants'
  const title = isRestaurants
    ? t('hero.restaurantTitle', { defaultValue: RESTAURANT_TITLE })
    : t('hero.title')
  const heroRef = useRef<HTMLElement>(null)

  return (
    <section className={`hero${isRestaurants ? ' hero--restaurants' : ''}`} ref={heroRef}>
      <div className="hero-content">
        <h1 className="hero-headline">
          {!isRestaurants && title === 'Book Unforgettable Experiences in Ghana' ? (
            <><span className="hero-headline-line">Book Unforgettable</span>{' '}<span className="hero-headline-line">Experiences in Ghana</span></>
          ) : title}
        </h1>
        <p className="hero-tagline">
          {isRestaurants
            ? t('hero.restaurantSubtitle', { defaultValue: RESTAURANT_SUBTITLE })
            : t('hero.subtitle')}
        </p>
        <SearchBar variant={variant} />
        <VerticalSwitch />
      </div>
    </section>
  )
}
