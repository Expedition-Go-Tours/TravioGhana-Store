import { useState } from 'react'
import { useParams } from 'react-router-dom'
import { Info, Star, TrendingDown, TrendingUp } from 'lucide-react'
import {
  dashboardError,
  useDashboardInsights,
  type Insights,
} from '../../../hooks/useRestaurantDashboard'
import {
  DashboardPageHeader,
  EmptyState,
  ErrorBlock,
  InfoNote,
  LoadingBlock,
  MetricCard,
  Stars,
  formatDate,
} from './components'

type Period = 7 | 30 | 90 | 365

function formatChange(value: number | null, suffix = ''): string {
  if (value == null) return 'No prior data'
  const rounded = Math.round(value * 10) / 10
  if (rounded === 0) return `No change ${suffix}`.trim()
  return `${rounded > 0 ? '+' : ''}${rounded}${suffix}`
}

function Delta({ value, suffix = '' }: { value: number | null; suffix?: string }) {
  if (value == null) return <small className="rd-delta rd-delta--muted">No prior data</small>
  const rounded = Math.round(value * 10) / 10
  const Icon = rounded > 0 ? TrendingUp : rounded < 0 ? TrendingDown : Info
  const tone = rounded > 0 ? 'good' : rounded < 0 ? 'warn' : 'muted'
  return (
    <small className={`rd-delta rd-delta--${tone}`}>
      <Icon size={13} /> {formatChange(value, suffix)} vs previous period
    </small>
  )
}

function ReviewChart({ insights }: { insights: Insights }) {
  if (!insights.hasData) {
    return (
      <EmptyState
        title="Not enough reviews in this window yet"
        description="The chart uses approved Travio reviews. It will fill in as diners review this restaurant."
      />
    )
  }

  const max = Math.max(1, ...insights.series.map((point) => point.reviews))

  return (
    <div className="rd-chart" aria-label="Approved reviews by month">
      {insights.series.map((point) => (
        <div className="rd-chart__col" key={point.key}>
          <span className="rd-chart__value">{point.reviews || ''}</span>
          <div className="rd-chart__track">
            <div
              className={point.negative > 0 ? 'rd-chart__bar rd-chart__bar--warn' : 'rd-chart__bar'}
              style={{ height: point.reviews ? `${Math.max(8, (point.reviews / max) * 100)}%` : '0%' }}
            />
          </div>
          <span className="rd-chart__label">{point.label}</span>
        </div>
      ))}
    </div>
  )
}

function Distribution({ distribution }: { distribution: Record<string, number> }) {
  const values = [5, 4, 3, 2, 1]
  const total = values.reduce((sum, value) => sum + (distribution[String(value)] || 0), 0)
  if (!total) {
    return <EmptyState title="No ratings in this window" description="Ratings appear once reviews are approved." />
  }

  return (
    <div className="rd-distribution">
      {values.map((value) => {
        const count = distribution[String(value)] || 0
        return (
          <div className="rd-distribution__row" key={value}>
            <span className="rd-distribution__key">
              {value} <Star size={12} fill="currentColor" />
            </span>
            <div className="rd-distribution__track">
              <span style={{ width: `${(count / total) * 100}%` }} />
            </div>
            <span className="rd-distribution__count">{count}</span>
          </div>
        )
      })}
    </div>
  )
}

export default function DashboardInsights() {
  const { slug = '' } = useParams<{ slug: string }>()
  const [days, setDays] = useState<Period>(30)
  const insights = useDashboardInsights(slug, days)

  return (
    <>
      <DashboardPageHeader
        eyebrow="Insights"
        title="How diners are responding"
        description="Every number here comes from approved Travio reviews and responses."
        actions={
          <label className="rd-period">
            Window
            <select value={days} onChange={(event) => setDays(Number(event.target.value) as Period)}>
              <option value={7}>Last 7 days</option>
              <option value={30}>Last 30 days</option>
              <option value={90}>Last 90 days</option>
              <option value={365}>Last 12 months</option>
            </select>
          </label>
        }
      />

      <InfoNote>
        Travio does not collect page views or competitor data, so none are shown. A zero means there
        were no matching records in that window, not an estimated value.
      </InfoNote>

      {insights.isPending ? (
        <LoadingBlock label="Calculating insights…" />
      ) : insights.isError ? (
        <ErrorBlock message={dashboardError(insights.error)} onRetry={() => void insights.refetch()} />
      ) : (
        <>
          <div className="rd-section__head rd-section__head--spaced">
            <h2>Review activity</h2>
            <span>
              {formatDate(insights.data.period.start)} – {formatDate(insights.data.period.end)}
            </span>
          </div>

          <div className="rd-metrics">
            <MetricCard
              label="Approved reviews"
              value={insights.data.current.count}
              hint={`${insights.data.previous.count} in the previous window`}
            />
            <MetricCard
              label="Average rating"
              value={
                insights.data.current.averageRating == null ? (
                  '—'
                ) : (
                  <span className="rd-metric__rating">
                    <Star size={17} fill="currentColor" /> {insights.data.current.averageRating.toFixed(1)}
                  </span>
                )
              }
              hint={
                insights.data.current.averageRating == null
                  ? 'No reviews in this window'
                  : `${insights.data.current.verified} from verified visits`
              }
            />
            <MetricCard
              label="Reply rate"
              value={insights.data.current.responseRate == null ? '—' : `${insights.data.current.responseRate}%`}
              hint={`${insights.data.current.replies} published replies`}
            />
            <MetricCard
              label="3 stars or lower"
              value={insights.data.current.negative}
              hint="Reviews that need a thoughtful reply"
              tone={insights.data.current.negative > 0 ? 'warn' : undefined}
            />
          </div>

          <div className="rd-delta-grid">
            <div><strong>Reviews</strong><Delta value={insights.data.deltas.reviews} /></div>
            <div><strong>Rating</strong><Delta value={insights.data.deltas.rating} /></div>
            <div><strong>Reply rate</strong><Delta value={insights.data.deltas.responseRate} suffix=" pts" /></div>
          </div>

          <div className="rd-twocol rd-twocol--insights">
            <section className="rd-section" aria-labelledby="rd-chart-title">
              <div className="rd-section__head">
                <h2 id="rd-chart-title">Reviews over time</h2>
                <span>Monthly buckets</span>
              </div>
              <ReviewChart insights={insights.data} />
            </section>

            <section className="rd-section" aria-labelledby="rd-distribution-title">
              <div className="rd-section__head">
                <h2 id="rd-distribution-title">Rating mix</h2>
                <span>{insights.data.current.count} reviews</span>
              </div>
              <Distribution distribution={insights.data.current.distribution} />
              {insights.data.current.averageRating != null && (
                <div className="rd-insight-stars">
                  <Stars rating={Math.round(insights.data.current.averageRating)} />
                  <span>{insights.data.current.averageRating.toFixed(1)} average</span>
                </div>
              )}
            </section>
          </div>

          <section className="rd-section" aria-labelledby="rd-method-title">
            <div className="rd-section__head">
              <h2 id="rd-method-title">How this is counted</h2>
            </div>
            <ul className="rd-method-list">
              <li>Approved reviews created in the selected window are included.</li>
              <li>Verified means the diner reviewed through a Travio-issued invite.</li>
              <li>Reply rate counts distinct reviews with a published owner reply.</li>
              <li>
                {insights.data.publishedMenus} published menu
                {insights.data.publishedMenus === 1 ? '' : 's'} and{' '}
                {insights.data.current.publishedPhotos} newly published photo
                {insights.data.current.publishedPhotos === 1 ? '' : 's'} in this window.
              </li>
            </ul>
          </section>
        </>
      )}
    </>
  )
}
