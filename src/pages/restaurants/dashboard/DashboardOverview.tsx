import { Link, useOutletContext, useParams } from 'react-router-dom'
import { BarChart3, ChevronRight, Star } from 'lucide-react'
import {
  dashboardError,
  useDashboardOverview,
  type DashboardSession,
} from '../../../hooks/useRestaurantDashboard'
import {
  AttentionRow,
  DashboardPageHeader,
  EmptyState,
  ErrorBlock,
  LoadingBlock,
  MetricCard,
  Stars,
  formatDateTime,
} from './components'

export default function DashboardOverview() {
  const { slug = '' } = useParams<{ slug: string }>()
  const session = useOutletContext<DashboardSession>()
  const query = useDashboardOverview(slug)

  if (query.isPending) return <LoadingBlock label="Building your overview…" />
  if (query.isError) {
    return <ErrorBlock message={dashboardError(query.error)} onRetry={() => void query.refetch()} />
  }

  const { overview } = query.data
  const { stats, completeness } = overview

  return (
    <>
      <DashboardPageHeader
        eyebrow="Overview"
        title={`Good day, ${session.venue.name}`}
        description="What needs your attention, and what diners currently see."
        actions={
          <Link className="rd-button rd-button--secondary" to={`/restaurants/${slug}/manage/insights`}>
            <BarChart3 size={15} /> View insights
          </Link>
        }
      />

      {overview.attention.length > 0 ? (
        <section className="rd-section" aria-labelledby="rd-attention-title">
          <div className="rd-section__head">
            <h2 id="rd-attention-title">Needs attention</h2>
            <span>{overview.attention.length} item{overview.attention.length === 1 ? '' : 's'}</span>
          </div>
          <div className="rd-attention-list">
            {overview.attention.map((item) => (
              <AttentionRow key={item.key} item={item} slug={slug} />
            ))}
          </div>
        </section>
      ) : (
        <div className="rd-allclear">
          <Star size={18} /> Everything is up to date. Nothing needs your attention right now.
        </div>
      )}

      <section className="rd-section" aria-labelledby="rd-stats-title">
        <div className="rd-section__head">
          <h2 id="rd-stats-title">Your listing at a glance</h2>
          <span>From real Travio diner activity</span>
        </div>
        <div className="rd-metrics">
          <MetricCard
            label="Travio rating"
            value={
              stats.rating == null ? (
                '—'
              ) : (
                <span className="rd-metric__rating">
                  <Star size={18} fill="currentColor" /> {stats.rating.toFixed(1)}
                </span>
              )
            }
            hint={`${stats.reviewCount} review${stats.reviewCount === 1 ? '' : 's'}`}
          />
          <MetricCard
            label="Reply rate"
            value={stats.responseRate == null ? '—' : `${stats.responseRate}%`}
            hint={`${stats.unansweredReviews} still waiting for a reply`}
            tone={stats.unansweredReviews > 0 ? 'warn' : 'good'}
          />
          <MetricCard
            label="City rank"
            value={stats.rank ? `#${stats.rank.position}` : '—'}
            hint={stats.rank?.of ? `of ${stats.rank.of} in ${session.venue.city || 'your city'}` : 'Not ranked yet'}
          />
          <MetricCard
            label="Photos live"
            value={stats.publishedPhotos}
            hint={
              stats.pendingPhotos > 0
                ? `${stats.pendingPhotos} still in moderation`
                : `${stats.totalPhotos} in your library`
            }
          />
        </div>
      </section>

      <section className="rd-section" aria-labelledby="rd-complete-title">
        <div className="rd-section__head">
          <h2 id="rd-complete-title">Listing completeness</h2>
          <span>{completeness.score}% complete</span>
        </div>
        <div className="rd-progress" aria-hidden="true">
          <span style={{ width: `${completeness.score}%` }} />
        </div>
        <ul className="rd-checks">
          {completeness.checks.map((check) => (
            <li key={check.key} className={check.done ? 'rd-check rd-check--done' : 'rd-check'}>
              <span>{check.done ? '✓' : '○'}</span> {check.label}
            </li>
          ))}
        </ul>
      </section>

      <div className="rd-twocol">
        <section className="rd-section" aria-labelledby="rd-recent-title">
          <div className="rd-section__head">
            <h2 id="rd-recent-title">Recent reviews</h2>
            <Link to={`/restaurants/${slug}/manage/reviews`}>
              All reviews <ChevronRight size={14} />
            </Link>
          </div>
          {overview.recentReviews.length === 0 ? (
            <EmptyState
              title="No reviews yet"
              description="Reviews from verified diners will appear here as they are approved."
            />
          ) : (
            <div className="rd-mini-list">
              {overview.recentReviews.map((review) => (
                <article key={review.id} className="rd-mini-review">
                  <Stars rating={review.rating} />
                  <div>
                    <strong>{review.title || 'Untitled review'}</strong>
                    <p>{review.body}</p>
                    <small>
                      {review.author?.name || 'Travio diner'} · {formatDateTime(review.createdAt)}
                    </small>
                  </div>
                  <span className={`rd-mini-review__state${review.answered ? ' is-answered' : ''}`}>
                    {review.answered ? 'Replied' : 'No reply'}
                  </span>
                </article>
              ))}
            </div>
          )}
        </section>

        <section className="rd-section" aria-labelledby="rd-activity-title">
          <div className="rd-section__head">
            <h2 id="rd-activity-title">Recent activity</h2>
            <Link to={`/restaurants/${slug}/manage/activity`}>
              All activity <ChevronRight size={14} />
            </Link>
          </div>
          {overview.recentActivity.length === 0 ? (
            <EmptyState title="Nothing logged yet" description="Edits made by your team appear here." />
          ) : (
            <ol className="rd-timeline">
              {overview.recentActivity.map((item) => (
                <li key={item.id}>
                  <span className="rd-timeline__dot" />
                  <div>
                    <strong>{item.action.split('.').pop()?.replace(/([A-Z])/g, ' $1') || item.action}</strong>
                    <small>
                      {item.actor?.name || 'System'} · {formatDateTime(item.createdAt)}
                    </small>
                  </div>
                </li>
              ))}
            </ol>
          )}
        </section>
      </div>
    </>
  )
}
