import { useRef } from 'react'
import { useTranslation } from 'react-i18next'
import SearchBar from './SearchBar'
import { useLocationSearch } from '../context/LocationSearchContext'
import './Hero.css'

export default function Hero() {
  const { t } = useTranslation()
  const heroRef = useRef<HTMLElement>(null)
  const { currentLocation, hasActiveSearch } = useLocationSearch()

  return (
    <section className="hero" ref={heroRef}>
      <div className="hero-content">
        <h1 className="hero-headline">{t('hero.title')}</h1>
        <p className="hero-tagline">{t('hero.subtitle')}</p>
        <SearchBar />
        {hasActiveSearch && currentLocation && (
          <div className="hero-active-chip">
            {t('hero.currentSearch', {
              location: currentLocation,
              defaultValue: 'Current search: {{location}}',
            })}
          </div>
        )}
      </div>
    </section>
  )
}
