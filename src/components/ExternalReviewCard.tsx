import { useState, useRef, useLayoutEffect } from 'react'
import { Link } from 'react-router-dom'
import type { ExternalReview } from '../hooks/useExternalReviews'
import { useReviewTourLink } from '../hooks/useReviewTourLink'
import StarRating from './StarRating'
import './ExternalReviewCard.css'

interface ExternalReviewCardProps {
  review: ExternalReview
  /**
   * Artwork for the tour the review is about. Scraped rows carry no image of
   * their own, so the homepage rail resolves one from our catalogue and falls
   * back to a neutral tile when nothing matches.
   */
  thumbnail?: string | null
  /** Specific tour detail page resolved from the review's listing title. */
  tourHref?: string
  /** False when the review is about a transfer / non-experience. */
  showCta?: boolean
  /**
   * Rendered as a swipe-loop copy: hidden from assistive tech and removed from
   * the tab order so the endless rail does not duplicate every card.
   */
  decorative?: boolean
}

export default function ExternalReviewCard({
  review,
  thumbnail,
  tourHref,
  showCta = true,
  decorative = false,
}: ExternalReviewCardProps) {
  const [showModal, setShowModal] = useState(false)
  const textRef = useRef<HTMLParagraphElement>(null)
  const [isTruncated, setIsTruncated] = useState(false)
  const fallbackTourLink = useReviewTourLink(review.tourTitle)
  // Prefer the exact tour the review is about; fall back to the destination
  // listing when the catalogue has no confident match.
  const tourLink = tourHref || fallbackTourLink

  useLayoutEffect(() => {
    const el = textRef.current
    if (!el) return
    const check = () => setIsTruncated(el.scrollHeight > el.clientHeight + 1)
    check()
    const observer = new ResizeObserver(check)
    observer.observe(el)
    return () => observer.disconnect()
  }, [review.text])

  const formattedDate = review.originalDate
    ? new Date(review.originalDate).toLocaleDateString('en-GB', { month: 'short', year: 'numeric' })
    : null

  return (
    <>
      <article className="ext-review-card" aria-hidden={decorative || undefined}>
        <div className="ext-review-card__body">
          {/* Tour identity: artwork + the experience the review is about. */}
          <div className="ext-review-card__head">
            {thumbnail ? (
              <img
                src={thumbnail}
                alt=""
                aria-hidden="true"
                className="ext-review-card__thumb"
                loading="lazy"
                decoding="async"
                width={56}
                height={56}
              />
            ) : (
              <span className="ext-review-card__thumb ext-review-card__thumb--placeholder" aria-hidden="true">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z" />
                  <circle cx="12" cy="10" r="3" />
                </svg>
              </span>
            )}
            <span className="ext-review-card__tour-title">{review.tourTitle}</span>
          </div>

          <div className="ext-review-card__stars">
            <StarRating
              value={review.rating}
              size={18}
              gap={1}
              filledColor="#16a34a"
              emptyColor="#e5e7eb"
            />
          </div>

          <div className="ext-review-card__reviewer">
            <span className="ext-review-card__reviewer-name">{review.reviewerName}</span>
            {formattedDate && <span className="ext-review-card__date">, {formattedDate}</span>}
          </div>

          {review.title && <p className="ext-review-card__title">{review.title}</p>}

          <p ref={textRef} className="ext-review-card__text">
            {review.text}
          </p>
          {isTruncated && (
            <button
              onClick={() => setShowModal(true)}
              className="ext-review-card__read-more"
              tabIndex={decorative ? -1 : undefined}
            >
              Read more
            </button>
          )}

          {/* Google rows are business-level reviews with no tour to link to,
              and transfers have no experience to open. */}
          {showCta && review.source !== 'GOOGLE' && (
            <div className="ext-review-card__footer">
              <Link to={tourLink} className="ext-review-card__cta" tabIndex={decorative ? -1 : undefined}>
                View Experience
              </Link>
            </div>
          )}
        </div>
      </article>

      {showModal && (
        <div className="ext-review-modal-overlay" onClick={() => setShowModal(false)}>
          <div className="ext-review-modal" onClick={(e) => e.stopPropagation()}>
            <button className="ext-review-modal__close" onClick={() => setShowModal(false)}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>

            <div className="ext-review-modal__header">
              <span className="ext-review-modal__tour-title">{review.tourTitle}</span>
              <div className="ext-review-modal__stars">
                <StarRating
                  value={review.rating}
                  size={20}
                  gap={1}
                  filledColor="#16a34a"
                  emptyColor="#e5e7eb"
                />
              </div>
              <div className="ext-review-modal__reviewer">
                <span className="ext-review-card__reviewer-name">{review.reviewerName}</span>
                {formattedDate && <span className="ext-review-card__date">, {formattedDate}</span>}
              </div>
            </div>

            {review.title && <h3 className="ext-review-modal__title">{review.title}</h3>}

            <p className="ext-review-modal__text">{review.text}</p>

            {review.source !== 'GOOGLE' && (
              <div className="ext-review-modal__footer">
                <Link to={tourLink} className="ext-review-card__cta">
                  View Experience
                </Link>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  )
}
