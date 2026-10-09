import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import './GhanaTravelSection.css'

export default function GhanaTravelSection() {
  const { t } = useTranslation()
  return (
    <section className="ghana-travel" aria-labelledby="ghana-travel-title">
      <h2 id="ghana-travel-title">{t('ghanaTravel.title')}</h2>
      <p>{t('ghanaTravel.intro')}</p>
      <div className="ghana-travel-grid">
        <article>
          <h3><Link to="/tours?place=Accra">{t('ghanaTravel.accraTitle')}</Link></h3>
          <p>{t('ghanaTravel.accraText')}</p>
        </article>
        <article>
          <h3><Link to="/tours?place=Cape%20Coast">{t('ghanaTravel.coastTitle')}</Link></h3>
          <p>{t('ghanaTravel.coastText')}</p>
        </article>
        <article>
          <h3><Link to="/tours">{t('ghanaTravel.vacationTitle')}</Link></h3>
          <p>{t('ghanaTravel.vacationText')}</p>
        </article>
      </div>
      <p>{t('ghanaTravel.packagesText')} <Link to="/tours">{t('ghanaTravel.browse')}</Link></p>
    </section>
  )
}
