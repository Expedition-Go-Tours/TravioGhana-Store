import { useState } from 'react'
import { useParams, useSearchParams } from 'react-router-dom'
import { Flag, LoaderCircle } from 'lucide-react'
import { toast } from 'sonner'
import {
  dashboardError,
  useCreateReviewResponse,
  useDeleteReviewResponse,
  useOwnerReviews,
  type DashboardSession,
  type OwnerReview,
} from '../../../hooks/useRestaurantDashboard'
import { useReportRestaurantReview } from '../../../hooks/useRestaurantActions'
import { useOutletContext } from 'react-router-dom'
import {
  DashboardPageHeader,
  EmptyState,
  ErrorBlock,
  LoadingBlock,
  ReviewCard,
} from './components'

const FILTERS = [
  { value: 'all', label: 'All reviews' },
  { value: 'unanswered', label: 'Needs a reply' },
  { value: 'negative', label: '3 stars or lower' },
  { value: 'replied', label: 'Replied' },
  { value: 'pending', label: 'In moderation' },
] as const

const REPORT_REASONS = [
  { value: 'FAKE', label: 'Not a real visit' },
  { value: 'OFF_TOPIC', label: 'Off topic' },
  { value: 'PERSONAL_INFORMATION', label: 'Contains personal information' },
  { value: 'PROFANITY', label: 'Abusive or offensive' },
  { value: 'CONFLICT_OF_INTEREST', label: 'Written by someone with a conflict of interest' },
]

function ReportDialog({
  review,
  onClose,
  onSubmitted,
}: {
  review: OwnerReview
  onClose: () => void
  onSubmitted: () => void
}) {
  const { slug = '' } = useParams<{ slug: string }>()
  const report = useReportRestaurantReview(slug)
  const [reason, setReason] = useState(REPORT_REASONS[0].value)
  const [detail, setDetail] = useState('')

  return (
    <div className="rd-modal" role="dialog" aria-modal="true" aria-label="Report review">
      <button className="rd-modal__scrim" type="button" aria-label="Close" onClick={onClose} />
      <form
        className="rd-modal__card"
        onSubmit={(event) => {
          event.preventDefault()
          report.mutate(
            { reviewId: review.id, reason, detail: detail || undefined },
            {
              onSuccess: () => {
                toast.success('Report sent. The Travio team will review it.')
                onSubmitted()
              },
              onError: (error) => toast.error(dashboardError(error)),
            },
          )
        }}
      >
        <h2>Report this review</h2>
        <p>Tell us what is wrong. A report does not remove a review on its own.</p>
        <label>
          Reason
          <select value={reason} onChange={(event) => setReason(event.target.value)}>
            {REPORT_REASONS.map((item) => (
              <option key={item.value} value={item.value}>
                {item.label}
              </option>
            ))}
          </select>
        </label>
        <label>
          More detail <span>(optional)</span>
          <textarea
            rows={4}
            value={detail}
            maxLength={1000}
            onChange={(event) => setDetail(event.target.value)}
            placeholder="What happened?"
          />
        </label>
        <div className="rd-modal__actions">
          <button type="button" className="rd-button rd-button--quiet" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className="rd-button rd-button--primary" disabled={report.isPending}>
            {report.isPending ? <LoaderCircle size={15} className="rd-spin" /> : <Flag size={15} />}
            Send report
          </button>
        </div>
      </form>
    </div>
  )
}

export default function DashboardReviews() {
  const { slug = '' } = useParams<{ slug: string }>()
  const session = useOutletContext<DashboardSession>()
  const [searchParams, setSearchParams] = useSearchParams()
  const [reporting, setReporting] = useState<OwnerReview | null>(null)

  const filter = searchParams.get('filter') || 'all'
  const sort = searchParams.get('sort') || 'newest'
  const rating = searchParams.get('rating') || ''
  const cursor = searchParams.get('cursor') || ''

  const reviews = useOwnerReviews(
    slug,
    {
      filter,
      sort,
      rating: rating ? Number(rating) : undefined,
      cursor: cursor || undefined,
    },
  )
  const reply = useCreateReviewResponse(slug)
  const deleteReply = useDeleteReviewResponse(slug)

  const canReply = session.permissions.includes('reviews.reply')
  const canReport = session.permissions.includes('reviews.report')

  const setParam = (key: string, value: string) => {
    const next = new URLSearchParams(searchParams)
    if (value && value !== 'all') next.set(key, value)
    else next.delete(key)
    if (key !== 'cursor') next.delete('cursor')
    setSearchParams(next)
  }

  return (
    <>
      <DashboardPageHeader
        eyebrow="Reviews"
        title="Reviews & replies"
        description="Reply to diners and flag reviews that break the rules. Published replies go through moderation."
      />

      <div className="rd-filterbar">
        <div className="rd-tabs" role="tablist" aria-label="Review filters">
          {FILTERS.map((item) => (
            <button
              key={item.value}
              type="button"
              role="tab"
              aria-selected={filter === item.value}
              className={filter === item.value ? 'rd-tab rd-tab--active' : 'rd-tab'}
              onClick={() => setParam('filter', item.value)}
            >
              {item.label}
            </button>
          ))}
        </div>
        <div className="rd-filterbar__selects">
          <label>
            Rating
            <select value={rating} onChange={(event) => setParam('rating', event.target.value)}>
              <option value="">Any</option>
              {[5, 4, 3, 2, 1].map((value) => (
                <option key={value} value={value}>
                  {value} stars
                </option>
              ))}
            </select>
          </label>
          <label>
            Sort
            <select value={sort} onChange={(event) => setParam('sort', event.target.value)}>
              <option value="newest">Newest first</option>
              <option value="oldest">Oldest first</option>
              <option value="lowest">Lowest rating</option>
            </select>
          </label>
        </div>
      </div>

      {reviews.isPending ? (
        <LoadingBlock label="Loading reviews…" />
      ) : reviews.isError ? (
        <ErrorBlock message={dashboardError(reviews.error)} onRetry={() => void reviews.refetch()} />
      ) : reviews.data.reviews.length === 0 ? (
        <EmptyState
          title="No reviews in this view"
          description="Change the filter to see more diners' feedback."
        />
      ) : (
        <>
          <div className="rd-review-list">
            {reviews.data.reviews.map((review) => (
              <div key={review.id} className="rd-review-wrap">
                <ReviewCard
                  review={review}
                  canReply={canReply}
                  replyPending={reply.isPending}
                  deletePending={deleteReply.isPending}
                  onReply={(body) =>
                    reply.mutate(
                      { reviewId: review.id, body },
                      {
                        onSuccess: () => toast.success('Reply sent for review.'),
                        onError: (error) => toast.error(dashboardError(error)),
                      },
                    )
                  }
                  onDeleteReply={(responseId) =>
                    deleteReply.mutate(responseId, {
                      onSuccess: () => toast.success('Reply removed. You can submit a new one.'),
                      onError: (error) => toast.error(dashboardError(error)),
                    })
                  }
                />
                {canReport && (
                  <button
                    type="button"
                    className="rd-report-link"
                    onClick={() => setReporting(review)}
                  >
                    <Flag size={13} /> Report review
                  </button>
                )}
              </div>
            ))}
          </div>

          <div className="rd-pagination">
            <span>
              {reviews.data.counts.total} reviews · {reviews.data.counts.unanswered} waiting for a reply
            </span>
            {cursor && (
              <button type="button" className="rd-button rd-button--quiet" onClick={() => setParam('cursor', '')}>
                Back to newest
              </button>
            )}
            {reviews.data.pagination.hasMore && reviews.data.pagination.nextCursor && (
              <button
                type="button"
                className="rd-button rd-button--secondary"
                onClick={() => setParam('cursor', reviews.data.pagination.nextCursor!)}
              >
                Load more
              </button>
            )}
          </div>
        </>
      )}

      {reporting && (
        <ReportDialog review={reporting} onClose={() => setReporting(null)} onSubmitted={() => setReporting(null)} />
      )}
    </>
  )
}
