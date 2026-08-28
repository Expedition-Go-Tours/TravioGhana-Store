import { useTranslation } from 'react-i18next'
import './TourOverview.css'

interface TourOverviewProps {
  description: string
}

export default function TourOverview({ description }: TourOverviewProps) {
  const { t } = useTranslation()
  const paragraphs = description.split('\n\n')

  return (
    <section className="tour-overview">
      <h2 className="tour-section-title">{t('tourDetail.aboutTour')}</h2>
      <div className="tour-overview-content">
        {paragraphs.map((para, idx) => (
          <p key={idx}>{para}</p>
        ))}
      </div>
    </section>
  )
}
