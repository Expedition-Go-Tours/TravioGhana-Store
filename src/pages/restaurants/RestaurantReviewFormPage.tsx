import { useState, type FormEvent } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import {
  BadgeCheck,
  Camera,
  ChevronRight,
  Info,
  LockKeyhole,
  PenLine,
  X,
} from 'lucide-react'
import { toast } from 'sonner'
import SEO from '../../components/SEO'
import Footer from '../../components/Footer'
import OptimizedImage from '../../components/shared/OptimizedImage'
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

const RATING_WORDS: Record<number, string> = {
  1: 'Terrible',
  2: 'Poor',
  3: 'Average',
  4: 'Very good',
  5: 'Excellent',
}

const SUB_RATINGS: { key: 'foodRating' | 'serviceRating' | 'atmosphereRating' | 'valueRating'; label: string }[] = [
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
    foodRating: review?.foodRating ?? 0,
    serviceRating: review?.serviceRating ?? 0,
    atmosphereRating: review?.atmosphereRating ?? 0,
    valueRating: review?.valueRating ?? 0,
    photos: review?.photos ?? [],
  }
}

function RatingPicker({
  name,
  label,
  value,
  onChange,
}: {
  name: string
  label: string
  value: number
  onChange: (value: number) => void
}) {
  return (
    <fieldset className="rr-rating-picker">
      <legend>{label}</legend>
      <div>
        {[1, 2, 3, 4, 5].map((rating) => (
          <label key={rating} className={value === rating ? 'is-selected' : ''}>
            <input
              type="radio"
              name={name}
              value={rating}
              checked={value === rating}
              onChange={() => onChange(rating)}
            />
            <span aria-hidden="true">★</span>
            <small>{RATING_WORDS[rating]}</small>
          </label>
        ))}
      </div>
    </fieldset>
  )
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
  const [values, setValues] = useState<FormValues>(() => initialValues(review))
  const [files, setFiles] = useState<File[]>([])
  const upload = useUploadRestaurantReviewPhotos(slug)
  const create = useCreateRestaurantReview(slug)
  const replace = useReplaceRestaurantReview(slug, review?.id ?? '')
  const busy = upload.isPending || create.isPending || replace.isPending

  const set = <K extends keyof FormValues>(key: K, value: FormValues[K]) =>
    setValues((current) => ({ ...current, [key]: value }))

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
        navigate(`/restaurants/${slug}?review=submitted`, { replace: true })
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'We could not send your review.')
    }
  }

  return (
    <form className="rr-form" onSubmit={(event) => void onSubmit(event)}>
      <RatingPicker
        name="overall"
        label="Overall rating"
        value={values.rating}
        onChange={(value) => set('rating', value)}
      />

      <div className="rf-field-row">
        <label>
          Visit date {proofToken ? '(set by your invite)' : '(optional)'}
          <input
            type="date"
            value={proofToken ? '' : values.visitedAt}
            onChange={(event) => set('visitedAt', event.target.value)}
            max={new Date().toISOString().slice(0, 10)}
            disabled={Boolean(proofToken) || Boolean(review)}
          />
        </label>
        <label>
          Review title
          <input
            value={values.title}
            onChange={(event) => set('title', event.target.value)}
            minLength={3}
            maxLength={120}
            placeholder="Sum up your visit"
          />
        </label>
      </div>

      <label>
        Your review <span aria-hidden="true">*</span>
        <textarea
          value={values.body}
          onChange={(event) => set('body', event.target.value)}
          minLength={20}
          maxLength={3000}
          rows={7}
          placeholder="What did you order? How was the service? What should another diner know?"
        />
        <small>{values.body.trim().length} characters · at least 20</small>
      </label>

      <div className="rr-subratings">
        <h2>Rate the details</h2>
        <p>Optional. These help other diners choose.</p>
        <div className="rr-subratings__grid">
          {SUB_RATINGS.map((item) => (
            <label key={item.key}>
              <span>{item.label}</span>
              <select
                value={values[item.key]}
                onChange={(event) => set(item.key, Number(event.target.value))}
              >
                <option value={0}>Not rated</option>
                {[1, 2, 3, 4, 5].map((rating) => (
                  <option key={rating} value={rating}>
                    {rating} · {RATING_WORDS[rating]}
                  </option>
                ))}
              </select>
            </label>
          ))}
        </div>
      </div>

      <div className="rr-photos">
        <h2>
          <Camera size={17} aria-hidden="true" /> Photos
        </h2>
        <p>Up to five images of food or the venue. Photos upload before the review is sent.</p>
        <input
          type="file"
          accept="image/*"
          multiple
          onChange={(event) => setFiles(Array.from(event.target.files ?? []).slice(0, 5))}
          aria-label="Add review photos"
        />
        {files.length > 0 && (
          <ul className="rr-photos__list">
            {files.map((file, index) => (
              <li key={`${file.name}-${index}`}>
                <span>{file.name}</span>
                <button
                  type="button"
                  aria-label={`Remove ${file.name}`}
                  onClick={() => setFiles((current) => current.filter((_, i) => i !== index))}
                >
                  <X size={13} aria-hidden="true" />
                </button>
              </li>
            ))}
          </ul>
        )}
        {values.photos.length > 0 && (
          <div className="rr-photos__existing">
            {values.photos.map((photo) => (
              <div key={photo}>
                <OptimizedImage src={photo} alt="" width={100} height={80} fit="crop" />
                <button
                  type="button"
                  aria-label="Remove saved photo"
                  onClick={() => set('photos', values.photos.filter((item) => item !== photo))}
                >
                  <X size={13} aria-hidden="true" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="rr-form__submit">
        <button type="submit" disabled={busy}>
          {busy ? 'Sending…' : review ? 'Send updated review' : 'Send review'}
        </button>
        <p>
          {review
            ? 'Your original review stays in the audit trail. The replacement goes back to moderation.'
            : proofToken
              ? 'A valid invite will mark this as a verified visit. Without one, it waits for moderation.'
              : 'Community reviews wait for moderation before they appear on the listing.'}
        </p>
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
    <div className="restaurants-page">
      <SEO title={`${reviewId ? 'Edit' : 'Write'} a review`} robots="noindex" />
      <main className="restaurants-page__main rf-page">
        <nav className="rh-breadcrumb" aria-label="Breadcrumb">
          <Link to="/">Home</Link>
          <ChevronRight size={13} aria-hidden="true" />
          <Link to="/restaurants">Restaurants</Link>
          <ChevronRight size={13} aria-hidden="true" />
          {venue ? (
            <Link to={`/restaurants/${venue.slug}`}>{venue.name}</Link>
          ) : (
            <span>Restaurant</span>
          )}
          <ChevronRight size={13} aria-hidden="true" />
          <span>{reviewId ? 'Edit review' : 'Write review'}</span>
        </nav>

        <div className="rf-shell">
          <div className="rf-main">
            <span className="rf-eyebrow">Travio diner review</span>
            <h1>{reviewId ? 'Update your review' : `Review ${venue?.name ?? 'this restaurant'}`}</h1>
            <p className="rf-intro">
              Write about your own visit. We check every review before it changes a public rating.
            </p>

            {venueQuery.isPending && <div className="restaurant-skeleton" />}
            {venueQuery.isError && (
              <div className="rf-state">
                <h2>We could not load this restaurant</h2>
                <p>Check the link and try again.</p>
                <button type="button" onClick={() => void venueQuery.refetch()}>
                  Try again
                </button>
              </div>
            )}

            {venue && (
              <div className="rf-venue-card">
                {venue.coverPhoto || venue.photos[0] ? (
                  <OptimizedImage
                    src={venue.coverPhoto || venue.photos[0]}
                    alt=""
                    width={88}
                    height={72}
                    fit="crop"
                  />
                ) : null}
                <div>
                  <strong>{venue.name}</strong>
                  <span>{locationText(venue) || 'Ghana'}</span>
                </div>
                <Link to={`/restaurants/${venue.slug}`}>View listing</Link>
              </div>
            )}

            {!user && (
              <div className="rf-state rf-state--gate">
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
              <div className="rf-notice">
                <BadgeCheck size={18} aria-hidden="true" />
                <span>We found a review invite in this link. We will check it when you submit.</span>
              </div>
            )}

            {user && reviewId && reviewQuery.isPending && <div className="restaurant-skeleton" />}
            {user && reviewId && reviewQuery.isError && (
              <div className="rf-state">
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
              <div className="rf-notice">
                <Info size={18} aria-hidden="true" />
                <span>
                  Editing review from {formatDate(review.createdAt)} · {review.status.toLowerCase()}.
                  A correction archives the old version and returns the replacement to moderation.
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

          <aside className="rf-aside">
            <h2>Before you write</h2>
            <ul>
              <li>Review a place only if you visited it.</li>
              <li>Do not include private details about staff or other diners.</li>
              <li>An invited visit is marked verified only when the invite checks out.</li>
              <li>Corrections replace the old review; they do not silently edit it.</li>
            </ul>
            <p className="rf-aside__icon">
              <PenLine size={16} aria-hidden="true" /> Reviews are public. Please write for other
              diners.
            </p>
          </aside>
        </div>
      </main>
      <Footer />
    </div>
  )
}
