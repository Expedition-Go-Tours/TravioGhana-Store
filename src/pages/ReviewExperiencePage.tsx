import { useState, useEffect, useRef, useMemo } from 'react'
import { Link, useParams, useNavigate, useLocation } from 'react-router-dom'
import {
  ChevronRight, ArrowLeft, Calendar, Camera, Image, Info,
} from 'lucide-react'
import { motion } from 'framer-motion'
import { toast } from 'sonner'
import { useTranslation } from 'react-i18next'
import i18n from '../i18n/config'
import Navbar from '../components/Navbar'
import Footer from '../components/Footer'
import ReviewTourCard from '../pages/tour-detail/ReviewTourCard'
import { CalendarPicker } from '../components/ui/apple-calendar-picker'
import { useCreateReview, useUpdateReview } from '../hooks/useExpeditionReviews'
import './ReviewExperiencePage.css'

const REVIEW_DRAFT_PREFIX = 'eg_review_draft:'
const REVIEW_SUBMISSION_PREFIX = 'eg_submitted_review:'

function getDraftKey(tourTitle: string) {
  return `${REVIEW_DRAFT_PREFIX}${encodeURIComponent(tourTitle || 'unknown-tour')}`
}

function readDraft(key: string) {
  try {
    const raw = sessionStorage.getItem(key)
    return raw ? JSON.parse(raw) : null
  } catch { return null }
}

function writeDraft(key: string, data: unknown) {
  try { sessionStorage.setItem(key, JSON.stringify(data)) } catch { console.warn('Failed to save review draft') }
}

function clearDraft(key: string) {
  try { sessionStorage.removeItem(key) } catch { console.warn('Failed to clear review draft') }
}

function writeSubmittedHandoff(tourTitle: string, tourId: string | null, review: unknown) {
  try {
    const keys = [
      tourId ? `${REVIEW_SUBMISSION_PREFIX}tour:${tourId}` : null,
      tourTitle ? `${REVIEW_SUBMISSION_PREFIX}title:${encodeURIComponent(tourTitle)}` : null,
    ].filter(Boolean)
    keys.forEach((k) => sessionStorage.setItem(k!, JSON.stringify(review)))
  } catch { console.warn('Failed to write submitted review handoff') }
}

function StarRating({ value, onChange, count = 5 }: { value: number; onChange: (v: number) => void; count?: number }) {
  return (
    <div className="review-star-rating">
      {Array.from({ length: count }, (_, i) => (
        <button
          key={i}
          type="button"
          onClick={() => onChange(i + 1)}
          className="review-star-btn"
        >
          <svg
            className={`review-star-svg ${i < value ? 'filled' : ''}`}
            fill="currentColor"
            viewBox="0 0 24 24"
          >
            <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
          </svg>
        </button>
      ))}
    </div>
  )
}

function CompanionToggle({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`companion-toggle ${active ? 'active' : ''}`}
    >
      {label}
    </button>
  )
}

export default function ReviewExperiencePage() {
  const { t } = useTranslation()
  const { tourTitle: tourSlugParam } = useParams()
  const navigate = useNavigate()
  const location = useLocation()
  const stateTour = location.state?.tour
  const returnTo = location.state?.returnTo || `/tour/${tourSlugParam || ''}#reviews`
  const stateBookingId: string | undefined = location.state?.bookingId
  const editingReviewId: string | undefined = location.state?.editingReviewId

  const tour = useMemo(() => stateTour || {
    title: tourSlugParam ? decodeURIComponent(tourSlugParam).replace(/-/g, ' ') : 'Tour',
    rating: 4.8,
    reviews: 248,
    duration: '8h',
    price: 85,
    image: 'https://images.unsplash.com/photo-1589656966895-2f33e7653819?auto=format&fit=crop&w=600&q=80',
    location: 'Accra, Ghana',
    slug: tourSlugParam || '',
    supplierName: 'Travio Ghana Tours Ltd',
    supplierLogo: 'https://images.unsplash.com/photo-1599305445671-ac291c95aaa9?auto=format&fit=crop&w=120&q=80',
  }, [stateTour, tourSlugParam])

  const tourCardImages = [tour.image, ...(Array.isArray(tour.images) ? tour.images : [])].filter(Boolean)

  const [overallRating, setOverallRating] = useState(0)
  const [subRatings, setSubRatings] = useState({ valueForMoney: 0, guide: 0, meeting: 0 })
  const [selectedDate, setSelectedDate] = useState<Date | null>(null)
  const [isCalendarOpen, setIsCalendarOpen] = useState(false)
  const [companions, setCompanions] = useState<Record<string, boolean>>({
    business: false, couples: false, family: false, friends: false, solo: false,
  })
  const [reviewText, setReviewText] = useState('')
  const [reviewTitle, setReviewTitle] = useState('')
  const [uploadedPhotos, setUploadedPhotos] = useState<File[]>([])
  const [photoPreviews, setPhotoPreviews] = useState<string[]>([])
  const [certified, setCertified] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const draftKey = tour.slug || 'unknown-tour'

  // Load draft from session storage on mount
  useEffect(() => {
    const draft = readDraft(getDraftKey(draftKey))
    if (draft) {
      if (draft.overallRating) window.setTimeout(() => setOverallRating(draft.overallRating), 0)
      if (draft.subRatings) window.setTimeout(() => setSubRatings(draft.subRatings), 0)
      if (draft.selectedDate) window.setTimeout(() => setSelectedDate(new Date(draft.selectedDate)), 0)
      if (draft.companions) window.setTimeout(() => setCompanions(draft.companions), 0)
      if (draft.reviewText) window.setTimeout(() => setReviewText(draft.reviewText), 0)
      if (draft.reviewTitle) window.setTimeout(() => setReviewTitle(draft.reviewTitle), 0)
      if (draft.certified) window.setTimeout(() => setCertified(draft.certified), 0)
    }
  }, [draftKey])

  // Save draft on changes
  useEffect(() => {
    const hasContent = overallRating || subRatings.valueForMoney || subRatings.guide ||
      subRatings.meeting || selectedDate || Object.values(companions).some(Boolean) ||
      reviewText.trim() || reviewTitle.trim() || certified
    if (!hasContent) return
    writeDraft(getDraftKey(draftKey), {
      tour, overallRating, subRatings, selectedDate: selectedDate?.toISOString() || null,
      companions, reviewText, reviewTitle, certified, returnTo,
    })
  }, [overallRating, subRatings, selectedDate, companions, reviewText, reviewTitle, certified, draftKey, tour, returnTo])

  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || [])
    const newPreviews = files.map((f) => URL.createObjectURL(f))
    setUploadedPhotos((prev) => [...prev, ...files].slice(0, 10))
    setPhotoPreviews((prev) => [...prev, ...newPreviews].slice(0, 10))
  }

  const removePhoto = (index: number) => {
    URL.revokeObjectURL(photoPreviews[index])
    setUploadedPhotos((prev) => prev.filter((_, i) => i !== index))
    setPhotoPreviews((prev) => prev.filter((_, i) => i !== index))
  }

  const createReview = useCreateReview()
  const updateReview = useUpdateReview()

  const handleSubmit = async () => {
    if (!overallRating) {
      toast.error(t('reviews.errorNoRating'))
      return
    }
    if (!reviewText.trim() || reviewText.trim().length < 20) {
      toast.error(t('reviews.errorMinLength'))
      return
    }
    if (!certified) {
      toast.error(t('reviews.errorNotCertified'))
      return
    }

    if (!editingReviewId && !stateBookingId) {
      toast.error(t('reviews.errorMissingBooking', {
        defaultValue: 'We couldn\u2019t find a completed booking to review. Please open this page from a completed booking.',
      }))
      return
    }

    setIsSubmitting(true)
    try {
      if (editingReviewId) {
        await updateReview.mutateAsync({
          id: editingReviewId,
          rating: overallRating,
          title: reviewTitle.trim() || undefined,
          comment: reviewText.trim(),
        })
      } else {
        await createReview.mutateAsync({
          bookingId: stateBookingId!,
          rating: overallRating,
          title: reviewTitle.trim() || undefined,
          comment: reviewText.trim(),
        })
      }

      const submittedReview = {
        id: `submitted-${Date.now()}`,
        name: t('common.you'),
        tag: t('reviews.traveler'),
        title: reviewTitle.trim() || null,
        date: new Date().toLocaleDateString(i18n.language, { month: 'short', year: 'numeric' }),
        rating: overallRating,
        text: reviewText.trim(),
        photos: [],
        valueForMoneyRating: subRatings.valueForMoney || null,
        guideRating: subRatings.guide || null,
        meetingRating: subRatings.meeting || null,
        tourId: tour.tourId || tour.id,
        tourTitle: tour.title,
      }

      writeSubmittedHandoff(tour.title, tour.tourId || tour.id, submittedReview)
      clearDraft(getDraftKey(draftKey))
      toast.success(t('reviews.submittedSuccess'))
      navigate(returnTo, {
        replace: true,
        state: { submittedReview, submittedReviewTourId: tour.tourId || tour.id, submittedReviewTourTitle: tour.title },
      })
    } catch (err) {
      toast.error(err instanceof Error && err.message ? err.message : t('reviews.submitError'))
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="review-page">
      <Navbar />
      <div className="review-page-navbar-offset" aria-hidden />

      <main className="review-main">
        <div className="review-container">
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="review-back-btn"
          >
            <ArrowLeft size={16} />
            {t('common.back')}
          </button>
        </div>

        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, ease: 'easeOut' }}
        >
          <div className="review-container review-main-content">
            <div className="review-columns">
              {/* Left Column */}
              <aside className="review-sidebar-col">
                <h1 className="review-heading">{t('reviews.tellUsAboutTrip')}</h1>
                <div className="review-sidebar-content">
                  <ReviewTourCard
                    images={tourCardImages}
                    rating={tour.rating}
                    title={tour.title}
                    supplierName={tour.supplierName}
                    supplierLogo={tour.supplierLogo}
                    location={tour.location}
                    duration={tour.duration}
                  />
                  <Link to="/tours" className="review-change-link">
                    {t('reviews.changeActivity')}
                    <ChevronRight size={16} />
                  </Link>
                </div>
              </aside>

              {/* Right Column */}
              <div className="review-form-col">
                {/* Overall Rating */}
                <section className="review-form-section">
                  <h2 className="review-form-section-title">{t('reviews.rateExperience')}</h2>
                  <StarRating value={overallRating} onChange={setOverallRating} />
                </section>

                {/* Sub-ratings */}
                <section className="review-form-section">
                  <h2 className="review-form-section-title">{t('reviews.rateThese')}</h2>
                  <div className="review-subratings">
                    <div className="review-subrating-row">
                      <span>{t('reviews.value')}</span>
                      <StarRating value={subRatings.valueForMoney} onChange={(v) => setSubRatings((p) => ({ ...p, valueForMoney: v }))} />
                    </div>
                    <div className="review-subrating-row">
                      <span>{t('reviews.guide')}</span>
                      <StarRating value={subRatings.guide} onChange={(v) => setSubRatings((p) => ({ ...p, guide: v }))} />
                    </div>
                    <div className="review-subrating-row">
                      <span>{t('reviews.meeting')}</span>
                      <StarRating value={subRatings.meeting} onChange={(v) => setSubRatings((p) => ({ ...p, meeting: v }))} />
                    </div>
                  </div>
                </section>

                {/* Date */}
                <section className="review-form-section">
                  <h2 className="review-form-section-title">{t('reviews.whenDidYouGo')}</h2>
                  <div className="review-date-wrapper">
                    <button
                      type="button"
                      onClick={() => setIsCalendarOpen(!isCalendarOpen)}
                      className="review-date-btn"
                    >
                      {selectedDate
                        ? selectedDate.toLocaleDateString(i18n.language, { month: 'long', year: 'numeric' })
                        : <span className="review-date-placeholder">{t('reviews.selectMonthYear')}</span>}
                    </button>
                    <Calendar size={16} className="review-date-icon" />
                    <CalendarPicker
                      isOpen={isCalendarOpen}
                      onClose={() => setIsCalendarOpen(false)}
                      onDateSelect={(date: Date) => setSelectedDate(date)}
                      selectedDate={selectedDate}
                    />
                  </div>
                </section>

                {/* Companions */}
                <section className="review-form-section">
                  <h2 className="review-form-section-title">{t('reviews.whoDidYouGoWith')}</h2>
                  <div className="review-companions">
                    {Object.entries(companions).map(([key, active]) => (
                      <CompanionToggle
                        key={key}
                        label={t(`reviews.companion.${key}`)}
                        active={active}
                        onClick={() => setCompanions((prev) => ({ ...prev, [key]: !prev[key] }))}
                      />
                    ))}
                  </div>
                </section>

                <hr className="review-divider" />

                {/* Write Review */}
                <section className="review-form-section">
                  <div className="review-write-header">
                    <h2 className="review-form-section-title">{t('reviews.writeYourReview')}</h2>
                    <button
                      type="button"
                      className="review-info-btn"
                      title={t('reviews.reviewHelpInfo')}
                    >
                      <Info size={12} />
                    </button>
                  </div>
                  <div className="review-categories">
                    {['tagExperience', 'tagAdmissionFee', 'tagLengthOfVisit', 'tagAtmosphere', 'tagCrowdSize', 'tagStaff', 'tagBestFor'].map((key) => (
                      <span key={key} className="review-category-tag">{t(`reviews.${key}`)}</span>
                    ))}
                  </div>
                  <div className="review-textarea-wrapper">
                    <textarea
                      value={reviewText}
                      onChange={(e) => setReviewText(e.target.value)}
                      placeholder={t('reviews.shareExperience')}
                      rows={6}
                      className="review-textarea"
                    />
                    <div className="review-textarea-count">
                      <span>{reviewText.length}/25 {t('reviews.min')}</span>
                    </div>
                  </div>
                </section>

                {/* Title */}
                <section className="review-form-section">
                  <h2 className="review-form-section-title">{t('reviews.titleYourReview')}</h2>
                  <input
                    type="text"
                    value={reviewTitle}
                    onChange={(e) => setReviewTitle(e.target.value)}
                    placeholder={t('reviews.gistPlaceholder')}
                    className="review-title-input"
                  />
                </section>

                {/* Photos */}
                <section className="review-form-section">
                  <h2 className="review-form-section-title">{t('reviews.addPhotos')}</h2>
                  <p className="review-photos-subtitle">{t('common.optional')}</p>
                  <div className="review-photos-info">
                    <div className="review-photos-info-icon">
                      <Camera size={20} />
                    </div>
                    <div>
                      <p className="review-photos-info-title">{t('reviews.photosMilestone')}</p>
                      <p className="review-photos-info-desc">{t('reviews.photosMilestoneDesc')}</p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="review-photos-upload"
                  >
                    <Image size={32} />
                    <span className="review-photos-upload-text">{t('reviews.clickToAddPhotos')}</span>
                    <span className="review-photos-upload-hint">{t('reviews.dragAndDrop')}</span>
                  </button>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    multiple
                    onChange={handlePhotoUpload}
                    className="review-photos-input"
                  />
                  {uploadedPhotos.length > 0 && (
                    <div className="review-photos-previews">
                      {photoPreviews.map((url, i) => (
                        <div key={i} className="review-photo-preview">
                          <img src={url} alt={t('reviews.uploadAlt', { number: i + 1 })} />
                          <button type="button" onClick={() => removePhoto(i)} className="review-photo-remove">
                            ✕
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </section>

                {/* Certification */}
                <section className="review-form-section">
                  <label className="review-certify">
                    <input
                      type="checkbox"
                      checked={certified}
                      onChange={(e) => setCertified(e.target.checked)}
                      className="review-certify-checkbox"
                    />
                    <span className="review-certify-text">
                      {t('reviews.certificationText')}
                    </span>
                  </label>
                </section>

                {/* Submit */}
                {!editingReviewId && !stateBookingId && (
                  <p className="review-missing-booking-notice" role="alert">
                    {t('reviews.errorMissingBooking', {
                      defaultValue: 'We couldn\u2019t find a completed booking to review. Please open this page from a completed booking.',
                    })}
                  </p>
                )}
                <button
                  type="button"
                  onClick={handleSubmit}
                  disabled={isSubmitting || !overallRating || !certified || (!editingReviewId && !stateBookingId)}
                  className="review-submit-btn"
                >
                  {isSubmitting ? t('common.submitting') : editingReviewId ? t('reviews.updateReview', { defaultValue: 'Update Review' }) : t('reviews.submitReview')}
                </button>
              </div>
            </div>
          </div>
        </motion.div>
      </main>

      <Footer />
    </div>
  )
}
