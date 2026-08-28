import { useTranslation } from 'react-i18next'
import SectionHeading from './SectionHeading'
import './CustomReviewsSection.css'

export default function CustomReviewsSection() {
  const { t } = useTranslation()
  return (
    <section className="reviews-section">
      <div className="reviews-container">
        <div className="reviews-viewport">
          <SectionHeading
            title={t('sections.whatTravellersAreSaying')}
            viewAllLink="https://www.tripadvisor.co.uk/Attraction_Review-g293797-d24155300-Reviews-travio_ghana_Tours_Ltd-Accra_Greater_Accra.html"
          />

          <div className="reviews-elfsight">
            <div className="elfsight-app-81f18ebc-8702-4317-b46f-6de7cfe86fa7" data-elfsight-app-lazy></div>
          </div>

          <div className="tripadvisor-bar">
            <span className="tripadvisor-text">{t('sections.poweredByTripadvisor')}</span>
          </div>
        </div>
      </div>
    </section>
  )
}
