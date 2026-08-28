import { useTranslation } from 'react-i18next'
import './NewsletterSection.css'
import heroSrc from '../assets/newsletter-hero.jpg'

export default function NewsletterSection() {
  const { t } = useTranslation()

  return (
    <section className="newsletter-section">
      <div className="newsletter-container">
        <div className="newsletter-viewport">
          <div className="newsletter-card">
        <div className="newsletter-image">
          <img src={heroSrc} alt={t('newsletter.imageAlt')} loading="lazy" decoding="async" width={600} height={400} />
        </div>
        <div className="newsletter-content">
          <h2 className="newsletter-heading">Don't just dream it, Book it</h2>
          <p className="newsletter-text">
            {t('newsletter.description')}
          </p>
          <form className="newsletter-form" onSubmit={(e) => e.preventDefault()}>
            <div className="newsletter-input-wrap">
              <input
                type="email"
                className="newsletter-input"
                placeholder={t('newsletter.emailPlaceholder')}
                required
                autoComplete="email"
              />
              <button type="submit" className="newsletter-btn">{t('newsletter.signUp')}</button>
            </div>
          </form>
          <p className="newsletter-disclaimer">
            {t('newsletter.disclaimer')} <a href="#" className="newsletter-link">{t('newsletter.privacyLink')}</a>.
          </p>
        </div>
          </div>
        </div>
      </div>
    </section>
  )
}
