import { useRef } from 'react'
import { useTranslation } from 'react-i18next'
import SearchBar from './SearchBar'
import './Hero.css'

export default function Hero() {
  const { t } = useTranslation()
  const title = t('hero.title')
  const heroRef = useRef<HTMLElement>(null)

  return (
    <section className="hero" ref={heroRef}>
      <div className="hero-content">
        <h1 className="hero-headline">{title === 'Book Unforgettable Experiences in Ghana' ? (
          <><span className="hero-headline-line">Book Unforgettable</span>{' '}<span className="hero-headline-line">Experiences in Ghana</span></>
        ) : title}</h1>
        <p className="hero-tagline">{t('hero.subtitle')}</p>
        <SearchBar />
      </div>
    </section>
  )
}

