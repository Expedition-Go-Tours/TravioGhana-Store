import { useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import SectionHeading from './SectionHeading'
import './CustomReviewsSection.css'

interface Props {
  location?: string
}

export default function CustomReviewsSection({ location }: Props) {
  const { t } = useTranslation()
  const heading = `${t('sections.whatTravellersAreSaying')} about ${location || 'Ghana'}`

  // Load the Elfsight platform script only once this section mounts (it is
  // wrapped in MountOnView, so it's deferred until scrolled into view).
  useEffect(() => {
    if (document.querySelector('script[src*="elfsightcdn.com/platform.js"]')) return
    const script = document.createElement('script')
    script.src = 'https://elfsightcdn.com/platform.js'
    script.async = true
    document.body.appendChild(script)
  }, [])

  return (
    <section className="reviews-section">
      <div className="reviews-container">
        <div className="reviews-viewport">
          <SectionHeading
            title={heading}
            viewAllLink="https://www.tripadvisor.co.uk/Attraction_Review-g293797-d24155300-Reviews-travio_ghana_Tours_Ltd-Accra_Greater_Accra.html"
          />

          <div className="reviews-elfsight">
            <div className="elfsight-app-81f18ebc-8702-4317-b46f-6de7cfe86fa7" data-elfsight-app-lazy></div>
          </div>
        </div>
      </div>
    </section>
  )
}
