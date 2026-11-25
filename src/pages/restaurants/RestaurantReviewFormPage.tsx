import { useEffect, useState, type FormEvent } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import {
  BadgeCheck,
  Camera,
  Info,
  LockKeyhole,
  PenLine,
  Sparkles,
  UploadCloud,
  X,
} from 'lucide-react'
import { toast } from 'sonner'
import SEO from '../../components/SEO'
import Footer from '../../components/Footer'
import OptimizedImage from '../../components/shared/OptimizedImage'
import { RATING_LABELS, StarRatingInput } from '../../components/StarRating'
import { useAuthUser } from '../../hooks/useAuthUser'
import { useAuthContext } from '../../context/AuthContext'
import { useRestaurantVenue } from '../../hooks/useRestaurantVenues'
import {
  useCreateRestaurantReview,
  useMyRestaurantReview,
  useReplaceRestaurantReview,
  useUploadRestaurantReviewPhotos,
  type AuthorRestaurantReview,
} from '../../hooks/useRestaurantActions'
import { formatDate, locationText } from './RestaurantPageBits'
import '../RestaurantsPage.css'
import './RestaurantPages.css'
import './RestaurantReviewFormPage.css'

const COMPANION_OPTIONS = [
  { value: 'BUSINESS', label: 'Business' },
  { value: 'COUPLES', label: 'Couples' },
  { value: 'FAMILY', label: 'Family' },
  { value: 'FRIENDS', label: 'Friends' },
  { value: 'SOLO', label: 'Solo' },
]

const SUB_RATINGS: {
  key: 'foodRating' | 'serviceRating' | 'atmosphereRating' | 'valueRating'
  label: string
}[] = [
  { key: 'foodRating', label: 'Food' },
  { key: 'serviceRating', label: 'Service' },
  { key: 'atmosphereRating', label: 'Atmosphere' },
  { key: 'valueRating', label: 'Value' },
]

interface FormValues {
  rating: number
  title: string
  body: string
  visitedAt: string
  companions: string[]
  foodRating: number
  serviceRating: number
  atmosphereRating: number
  valueRating: number
  photos: string[]
}

function initialValues(review?: AuthorRestaurantReview): FormValues {
  return {
    rating: review?.rating ?? 0,
    title: review?.title ?? '',
    body: review?.body ?? '',
    visitedAt: review?.visitedAt ? review.visitedAt.slice(0, 10) : '',
    companions: review?.companions ?? [],
    foodRating: review?.foodRating ?? 0,
    serviceRating: review?.serviceRating ?? 0,
    atmosphereRating: review?.atmosphereRating ?? 0,
    valueRating: review?.valueRating ?? 0,
    photos: review?.photos ?? [],
  }
}

function ReviewForm({
  slug,
  review,
  proofToken,
}: {
  slug: string
  review?: AuthorRestaurantReview
  proofToken?: string
}) {
  const navigate = useNavigate()
  const draftKey = `travio:restaurant-review:${slug}:${review?.id ?? 'new'}`
  const [values, setValues] = useState<FormValues>(() => {
    if (review) return initialValues(review)
    try {
      const draft = localStorage.getItem(draftKey)
      if (draft) return { ...initialValues(), ...(JSON.parse(draft) as Partial<FormValues>) }
    } catch {
      /* ignore malformed drafts */
    }
    return initialValues()
  })
  const [files, setFiles] = useState<File[]>([])
  const [certified, setCertified] = useState(false)
  const [draftSaved, setDraftSaved] = useState(false)
  const [tipsOpen, setTipsOpen] = useState(false)
  const upload = useUploadRestaurantReviewPhotos(slug)
  const create = useCreateRestaurantReview(slug)
  const replace = useReplaceRestaurantReview(slug, review?.id ?? '')
  const busy = upload.isPending || create.isPending || replace.isPending

  useEffect(() => {
    if (review) return
    const timer = window.setTimeout(() => {
      try {
        localStorage.setItem(draftKey, JSON.stringify(values))
        setDraftSaved(true)
      } catch {
        /* storage can be unavailable */
      }
    }, 500)
    return () => window.clearTimeout(timer)
  }, [draftKey, review, values])

  const set = <K extends keyof FormValues>(key: K, value: FormValues[K]) => {
    setDraftSaved(false)
    setValues((current) => ({ ...current, [key]: value }))
  }

  const toggleCompanion = (companion: string) => {
    set(
      'companions',
      values.companions.includes(companion)
        ? values.companions.filter((item) => item !== companion)
        : [...values.companions, companion],
    )
  }

  const addFiles = (incoming: FileList | null) => {
    const next = Array.from(incoming ?? []).filter((file) => file.type.startsWith('image/'))
    setFiles((current) => [...current, ...next].slice(0, Math.max(0, 5 - values.photos.length)))
    setDraftSaved(false)
  }

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!values.rating) {
      toast.error('Choose an overall rating before submitting.')
      return
    }
    if (values.body.trim().length < 20) {
      toast.error('Write at least 20 characters about your visit.')
      return
    }
    if (!certified) {
      toast.error('Please confirm this review is based on your own visit.')
      return
    }

    try {
      let photos = values.photos
      if (files.length) {
        const uploaded = await upload.mutateAsync(files)
        photos = [...new Set([...photos, ...uploaded.photos])].slice(0, 5)
      }

      const content = {
        rating: values.rating,
        title: values.title.trim(),
        body: values.body.trim(),
        companions: values.companions,
        foodRating: values.foodRating || undefined,
        serviceRating: values.serviceRating || undefined,
        atmosphereRating: values.atmosphereRating || undefined,
        valueRating: values.valueRating || undefined,
        photos,
      }

      if (review) {
        await replace.mutateAsync(content)
        navigate(`/restaurants/${slug}?review=updated`, { replace: true })
      } else {
        await create.mutateAsync({
          ...content,
          visitedAt: values.visitedAt || undefined,
          proofToken,
        })
        localStorage.removeItem(draftKey)
        navigate(`/restaurants/${slug}?review=submitted`, { replace: true })
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'We could not send your review.')
    }
  }

  return (
    <form className="rvf-form" onSubmit={(event) => void onSubmit(event)}>
      <section className="rvf-block">
        <h2>How would you rate your experience?</h2>
        <div className="rvf-stars">
          <StarRatingInput
            name="overall"
            label="Your rating"
            value={values.rating}
            onChange={(value) => set('rating', value)}
            showLabels={false}
          />
          {values.rating > 0 && (
            <span className="rvf-stars__word">{RATING_LABELS[values.rating - 1]}</span>
          )}
        </div>
      </section>

      <section className="rvf-block">
        <h2>When did you go?</h2>
        <input
          className="rvf-pill-input"
          type="month"
          value={values.visitedAt ? values.visitedAt.slice(0, 7) : ''}
          onChange={(event) => set('visitedAt', event.target.value ? `${event.target.value}-01` : '')}
          max={new Date().toISOString().slice(0, 7)}
          disabled={Boolean(proofToken) || Boolean(review)}
          aria-label="When did you go?"
        />
        {proofToken && <small className="rvf-hint">Set by your visit invite.</small>}
      </section>

      <section className="rvf-block">
        <h2>Who did you go with?</h2>
        <div className="rvf-pills">
          {COMPANION_OPTIONS.map((option) => (
            <label key={option.value} className={values.companions.includes(option.value) ? 'is-selected' : ''}>
              <input
                type="checkbox"
                checked={values.companions.includes(option.value)}
                onChange={() => toggleCompanion(option.value)}
              />
              {option.label}
            </label>
          ))}
        </div>
      </section>

      <section className="rvf-block">
        <h2>
          Write your review <Info size={17} aria-label="Review guidance" />
        </h2>
        <textarea
          aria-label="Your review"
          value={values.body}
          onChange={(event) => set('body', event.target.value)}
          minLength={20}
          maxLength={3000}
          rows={8}
          placeholder="Share your experience…"
        />
        <div className="rvf-textarea-meta">
          <button className="rvf-help" type="button" onClick={() => setTipsOpen((open) => !open)}>
            <Sparkles size={14} aria-hidden="true" /> Help me write
          </button>
          <span>{values.body.trim().length} / 3000 · min 20</span>
        </div>

        {tipsOpen && (
          <div className="rvf-tips">
            <strong>A good review answers three things</strong>
            <ul>
              <li>What did you order, and what stood out?</li>
              <li>How was the service and the room?</li>
              <li>Would you come back, and who would you bring?</li>
            </ul>
          </div>
        )}
      </section>

      <section className="rvf-block">
        <h2>Title your review</h2>
        <input
          className="rvf-text-input"
          value={values.title}
          onChange={(event) => set('title', event.target.value)}
          minLength={3}
          maxLength={120}
          placeholder="Give us the gist of your experience"
          aria-label="Title your review"
        />
      </section>

      <details className="rvf-details">
        <summary>Rate the details <span>Optional</span></summary>
        <div className="rvf-details__grid">
          {SUB_RATINGS.map((item) => (
            <div key={item.key} className="rvf-detail-rating">
              <span>{item.label}</span>
              <StarRatingInput
                compact
                name={item.key}
                label={`${item.label} rating`}
                value={values[item.key]}
                onChange={(value) => set(item.key, value)}
              />
            </div>
          ))}
        </div>
      </details>

      <section className="rvf-block">
        <div className="rvf-block__head">
          <h2>Add some photos</h2>
          <span>Optional</span>
        </div>
        <div
          className="rvf-photo-drop"
          onDragOver={(event) => event.preventDefault()}
          onDrop={(event) => {
            event.preventDefault()
            addFiles(event.dataTransfer.files)
          }}
        >
          <input
            id="rvf-photo-input"
            className="sr-only"
            type="file"
            accept="image/*"
            multiple
            aria-label="Add review photos"
            onChange={(event) => addFiles(event.target.files)}
          />
          <label htmlFor="rvf-photo-input">
            <Camera size={22} aria-hidden="true" />
            <strong>Click to add photos</strong>
            <span>or drag and drop · up to 5 photos</span>
          </label>
        </div>

        {(files.length > 0 || values.photos.length > 0) && (
          <div className="rvf-photos">
            {values.photos.map((photo) => (
              <div key={photo} className="rvf-photo">
                <OptimizedImage src={photo} alt="" width={140} height={105} fit="crop" />
                <button
                  type="button"
                  aria-label="Remove saved photo"
                  onClick={() => set('photos', values.photos.filter((item) => item !== photo))}
                >
                  <X size={13} />
                </button>
              </div>
            ))}
            {files.map((file, index) => (
              <div key={`${file.name}-${index}`} className="rvf-photo rvf-photo--file">
                <UploadCloud size={18} aria-hidden="true" />
                <span>{file.name}</span>
                <button
                  type="button"
                  aria-label={`Remove ${file.name}`}
                  onClick={() => setFiles((current) => current.filter((_, i) => i !== index))}
                >
                  <X size={13} />
                </button>
              </div>
            ))}
          </div>
        )}
        <p className="rvf-photo-guidelines">
          Family friendly · original, non-copyrighted images · no more than five photos.
        </p>
      </section>

      <label className="rvf-certify">
        <input
          type="checkbox"
          checked={certified}
          onChange={(event) => setCertified(event.target.checked)}
        />
        <span>
          I certify that this review is based on my own experience and is my genuine opinion of this
          restaurant. I have no personal or business relationship with this establishment, and I have
          not been offered any incentive or payment to write this review.
        </span>
      </label>

      <div className="rvf-submit">
        <button type="submit" disabled={busy}>
          {busy ? 'Sending…' : review ? 'Send updated review' : 'Send review'}
        </button>
        <span className={draftSaved ? 'rvf-draft is-saved' : 'rvf-draft'}>
          {review
            ? 'Corrections return to moderation.'
            : draftSaved
              ? 'Draft saved'
              : 'Draft saves as you type'}
        </span>
      </div>
    </form>
  )
}

export default function RestaurantReviewFormPage() {
  const { slug = '', reviewId } = useParams<{ slug: string; reviewId?: string }>()
  const [searchParams] = useSearchParams()
  const user = useAuthUser()
  const { promptSignIn } = useAuthContext()
  const venueQuery = useRestaurantVenue(slug)
  const reviewQuery = useMyRestaurantReview(slug, reviewId, Boolean(user))
  const proofToken = searchParams.get('invite') || searchParams.get('proofToken') || undefined
  const venue = venueQuery.data
  const review = reviewQuery.data?.review

  return (
    <div className="restaurants-page rvf-page-shell">
      <SEO title={`${reviewId ? 'Edit' : 'Write'} a review`} robots="noindex" />
      <main className="restaurants-page__main rvf-page">
        <div className="rvf-layout">
          <aside className="rvf-intro">
            <h1>{reviewId ? 'Update your review' : 'Tell us, how was your visit?'}</h1>
            {venue && (
              <div className="rvf-venue-card">
                {venue.coverPhoto || venue.photos[0] ? (
                  <OptimizedImage
                    src={venue.coverPhoto || venue.photos[0]}
                    alt=""
                    width={220}
                    height={190}
                    fit="crop"
                    priority
                  />
                ) : (
                  <span className="rvf-venue-card__placeholder">
                    <Camera size={22} />
                  </span>
                )}
                <strong>{venue.name}</strong>
                <span>{locationText(venue) || 'Ghana'}</span>
              </div>
            )}
          </aside>

          <div className="rvf-content">
            {venueQuery.isPending && <div className="restaurant-skeleton" />}
            {venueQuery.isError && (
              <div className="rvf-state">
                <h2>We could not load this restaurant</h2>
                <p>Check the link and try again.</p>
                <button type="button" onClick={() => void venueQuery.refetch()}>
                  Try again
                </button>
              </div>
            )}

            {!user && (
              <div className="rvf-state rvf-state--gate">
                <LockKeyhole size={22} aria-hidden="true" />
                <h2>Sign in to write a review</h2>
                <p>Your review is tied to your Travio account, so verified visits can be checked.</p>
                <button
                  type="button"
                  onClick={() =>
                    promptSignIn(`/restaurants/${slug}${reviewId ? `/reviews/${reviewId}/edit` : '/review'}`)
                  }
                >
                  Sign in
                </button>
              </div>
            )}

            {proofToken && user && (
              <div className="rvf-notice">
                <BadgeCheck size={18} aria-hidden="true" />
                <span>We found a review invite in this link. We will check it when you submit.</span>
              </div>
            )}

            {user && reviewId && reviewQuery.isPending && <div className="restaurant-skeleton" />}
            {user && reviewId && reviewQuery.isError && (
              <div className="rvf-state">
                <h2>We could not load that review</h2>
                <p>
                  {reviewQuery.error instanceof Error
                    ? reviewQuery.error.message
                    : 'It may have been removed or belong to another account.'}
                </p>
                <Link to={`/restaurants/${slug}/review`}>Write a new review</Link>
              </div>
            )}

            {user && reviewId && review && (
              <div className="rvf-notice">
                <PenLine size={18} aria-hidden="true" />
                <span>
                  Editing review from {formatDate(review.createdAt)} · {review.status.toLowerCase()}. A
                  correction archives the old version and returns the replacement to moderation.
                </span>
              </div>
            )}

            {user && (!reviewId || review) && (
              <ReviewForm
                key={`${slug}:${reviewId ?? 'new'}:${review?.id ?? ''}`}
                slug={slug}
                review={review}
                proofToken={proofToken}
              />
            )}
          </div>
        </div>
      </main>
      <Footer />
    </div>
  )
}
