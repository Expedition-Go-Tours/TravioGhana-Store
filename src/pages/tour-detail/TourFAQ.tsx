import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { motion, AnimatePresence } from 'framer-motion'
import type { FAQ } from '../../lib/tourTypes'
import './TourFAQ.css'

interface TourFAQProps {
  faqs: FAQ[]
}

export default function TourFAQ({ faqs }: TourFAQProps) {
  const { t } = useTranslation()
  const [expandedFaq, setExpandedFaq] = useState<string | null>(null)

  const toggleFaq = (id: string) => {
    setExpandedFaq(expandedFaq === id ? null : id)
  }

  return (
    <section className="tour-faq">
      <h2 className="tour-section-title">{t('tourDetail.faq')}</h2>
      
      <div className="faq-list">
        {faqs.map((faq) => {
          const isExpanded = expandedFaq === faq.id

          return (
            <div key={faq.id} className={`faq-item ${isExpanded ? 'expanded' : ''}`}>
              <button
                className="faq-question"
                onClick={() => toggleFaq(faq.id)}
                aria-expanded={isExpanded}
              >
                <span>{faq.question}</span>
                <motion.svg
                  className="faq-chevron"
                  width="20"
                  height="20"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  animate={{ rotate: isExpanded ? 180 : 0 }}
                  transition={{ duration: 0.2 }}
                >
                  <polyline points="6 9 12 15 18 9" />
                </motion.svg>
              </button>

              <AnimatePresence initial={false}>
                {isExpanded && (
                  <motion.div
                    className="faq-answer"
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.3, ease: 'easeInOut' }}
                  >
                    <div className="faq-answer-inner">
                      <p>{faq.answer}</p>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          )
        })}
      </div>
    </section>
  )
}
