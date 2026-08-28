import { useTranslation } from 'react-i18next'
import './InformationContact.css'

interface InformationContactProps {
  email: string
  website: string
  phone: string
  fax?: string
}

export default function InformationContact({ email, website, phone, fax }: InformationContactProps) {
  const { t } = useTranslation()
  return (
    <div className="information-contact">
      <h3 className="information-contact-title">{t('tourDetail.informationContact')}</h3>
      
      <div className="information-contact-list">
        <div className="information-contact-item">
          <span className="information-contact-label">{t('tourDetail.email')}</span>
          <a href={`mailto:${email}`} className="information-contact-value">
            {email}
          </a>
        </div>

        <div className="information-contact-item">
          <span className="information-contact-label">{t('tourDetail.website')}</span>
          <a 
            href={website.startsWith('http') ? website : `https://${website}`} 
            className="information-contact-value"
            target="_blank"
            rel="noopener noreferrer"
          >
            {website}
          </a>
        </div>

        <div className="information-contact-item">
          <span className="information-contact-label">{t('tourDetail.phone')}</span>
          <a href={`tel:${phone}`} className="information-contact-value">
            {phone}
          </a>
        </div>

        {fax && (
          <div className="information-contact-item">
            <span className="information-contact-label">{t('tourDetail.fax')}</span>
            <span className="information-contact-value">
              {fax}
            </span>
          </div>
        )}
      </div>
    </div>
  )
}
