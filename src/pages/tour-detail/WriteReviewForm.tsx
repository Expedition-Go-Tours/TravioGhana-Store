import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { motion, AnimatePresence } from 'framer-motion'
import { ChevronDown, Star } from 'lucide-react'
import './WriteReviewForm.css'

export default function WriteReviewForm() {
  const { t } = useTranslation()
  const [isOpen, setIsOpen] = useState(false)
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    title: '',
    content: '',
    ratings: {
      sleep: 0,
      location: 0,
      service: 0,
      cleanliness: 0,
      guidance: 0,
    }
  })

  const [hoveredRatings, setHoveredRatings] = useState({
    sleep: 0,
    location: 0,
    service: 0,
    cleanliness: 0,
    guidance: 0,
  })

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target
    setFormData(prev => ({ ...prev, [name]: value }))
  }

  const handleRatingClick = (category: keyof typeof formData.ratings, rating: number) => {
    setFormData(prev => ({
      ...prev,
      ratings: { ...prev.ratings, [category]: rating }
    }))
  }

  const handleRatingHover = (category: keyof typeof hoveredRatings, rating: number) => {
    setHoveredRatings(prev => ({ ...prev, [category]: rating }))
  }

  const handleRatingLeave = (category: keyof typeof hoveredRatings) => {
    setHoveredRatings(prev => ({ ...prev, [category]: 0 }))
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    console.log('Review submitted:', formData)
    // Handle form submission here
    // Reset form after submission
    setFormData({
      name: '',
      email: '',
      title: '',
      content: '',
      ratings: {
        sleep: 0,
        location: 0,
        service: 0,
        cleanliness: 0,
        guidance: 0,
      }
    })
    setIsOpen(false)
  }

  const ratingCategories = [
    { key: 'sleep' as const, label: t('reviews.sleep') },
    { key: 'location' as const, label: t('reviews.location') },
    { key: 'service' as const, label: t('reviews.service') },
    { key: 'cleanliness' as const, label: t('reviews.cleanliness') },
    { key: 'guidance' as const, label: t('reviews.guidance') },
  ]

  return (
    <div className="write-review-wrapper">
      <button
        className="write-review-toggle"
        onClick={() => setIsOpen(!isOpen)}
        aria-expanded={isOpen}
      >
        <span>{t('reviews.writeAReview')}</span>
        <motion.div
          animate={{ rotate: isOpen ? 180 : 0 }}
          transition={{ duration: 0.3 }}
        >
          <ChevronDown size={20} />
        </motion.div>
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            className="write-review-form-container"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3 }}
          >
            <form className="write-review-form" onSubmit={handleSubmit}>
              <h3 className="write-review-title">{t('reviews.leaveAReview')}</h3>
              <p className="write-review-subtitle">
                {t('reviews.emailNotPublished')}
              </p>

              <div className="write-review-row">
                <div className="write-review-field">
                  <input
                    type="text"
                    name="name"
                    placeholder={t('reviews.namePlaceholder')}
                    value={formData.name}
                    onChange={handleInputChange}
                    required
                    className="write-review-input"
                  />
                </div>

                <div className="write-review-field">
                  <input
                    type="email"
                    name="email"
                    placeholder={t('reviews.emailPlaceholder')}
                    value={formData.email}
                    onChange={handleInputChange}
                    required
                    className="write-review-input"
                  />
                </div>
              </div>

              <div className="write-review-field">
                <input
                  type="text"
                  name="title"
                    placeholder={t('reviews.titlePlaceholder')}
                  value={formData.title}
                  onChange={handleInputChange}
                  required
                  className="write-review-input"
                />
              </div>

              <div className="write-review-row">
                <div className="write-review-ratings">
                  {ratingCategories.map((category) => (
                    <div key={category.key} className="write-review-rating-row">
                      <span className="write-review-rating-label">{category.label}</span>
                      <div className="write-review-stars">
                        {[1, 2, 3, 4, 5].map((star) => (
                          <button
                            key={star}
                            type="button"
                            className="write-review-star-btn"
                            onClick={() => handleRatingClick(category.key, star)}
                            onMouseEnter={() => handleRatingHover(category.key, star)}
                            onMouseLeave={() => handleRatingLeave(category.key)}
                          >
                            <Star
                              size={24}
                              fill={
                                star <= (hoveredRatings[category.key] || formData.ratings[category.key])
                                  ? '#179237'
                                  : 'none'
                              }
                              stroke={
                                star <= (hoveredRatings[category.key] || formData.ratings[category.key])
                                  ? '#179237'
                                  : '#cbd5e1'
                              }
                            />
                          </button>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>

                <div className="write-review-field write-review-content-field">
                  <textarea
                    name="content"
                    placeholder={t('reviews.contentPlaceholder')}
                    value={formData.content}
                    onChange={handleInputChange}
                    required
                    rows={8}
                    className="write-review-textarea"
                  />
                </div>
              </div>

              <button type="submit" className="write-review-submit">
                {t('reviews.postReview')}
              </button>
            </form>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
