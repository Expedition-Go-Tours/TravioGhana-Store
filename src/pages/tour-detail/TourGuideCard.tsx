import { useTranslation } from 'react-i18next'
import './TourGuideCard.css'
import OptimizedImage from '@/components/shared/OptimizedImage'

interface TourGuideCardProps {
  name: string
  memberSince: string
  avatar: string
}

export default function TourGuideCard({ name, memberSince, avatar }: TourGuideCardProps) {
  const { t } = useTranslation()
  return (
    <div className="tour-guide-card">
      <div className="tour-guide-avatar-wrapper">
        <OptimizedImage 
          src={avatar} 
          alt={name}
          className="tour-guide-avatar"
          width={100}
        />
      </div>
      
      <h3 className="tour-guide-name">{name}</h3>
      
      <p className="tour-guide-since">{t('tourDetail.memberSince', { year: memberSince })}</p>
      
      <button className="tour-guide-question-btn">
        {t('tourDetail.askQuestion')}
      </button>
    </div>
  )
}
