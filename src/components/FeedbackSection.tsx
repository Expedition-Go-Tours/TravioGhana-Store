import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import './FeedbackSection.css'

export default function FeedbackSection() {
  const { t } = useTranslation()
  const [feedback, setFeedback] = useState<'up' | 'down' | null>(null)

  return (
    <section className="feedback-section">
      <div className="feedback-container">
        <div className="feedback-viewport">
          <h3 className="feedback-title">{t('feedback.title')}</h3>
          <div className="feedback-bar">
            <p className="feedback-question">{t('feedback.question')}</p>
            <div className="feedback-actions">
              <button
                className={`feedback-btn${feedback === 'up' ? ' active up' : ''}`}
                onClick={() => setFeedback('up')}
                aria-label={t('feedback.yes')}
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M14 9V5a3 3 0 0 0-3-3l-4 9v11h11.28a2 2 0 0 0 2-1.7l1.38-9a2 2 0 0 0-2-2.3zM7 22H4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h3" />
                </svg>
              </button>
              <button
                className={`feedback-btn${feedback === 'down' ? ' active down' : ''}`}
                onClick={() => setFeedback('down')}
                aria-label={t('feedback.no')}
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M10 15v4a3 3 0 0 0 3 3l4-9V2H5.72a2 2 0 0 0-2 1.7l-1.38 9a2 2 0 0 0 2 2.3zM17 2h2.67A2.31 2.31 0 0 1 22 4v7a2.31 2.31 0 0 1-2.33 2H17" />
                </svg>
              </button>
            </div>
            {feedback && (
              <span className="feedback-thanks">{t('feedback.thanks')}</span>
            )}
          </div>
        </div>
      </div>
    </section>
  )
}
