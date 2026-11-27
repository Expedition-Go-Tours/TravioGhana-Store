import { useParams, useSearchParams } from 'react-router-dom'
import {
  dashboardError,
  useDashboardActivity,
  type ActivityItem,
} from '../../../hooks/useRestaurantDashboard'
import {
  DashboardPageHeader,
  EmptyState,
  ErrorBlock,
  InfoNote,
  LoadingBlock,
  formatDateTime,
} from './components'

const TYPES = [
  { value: '', label: 'Everything' },
  { value: 'business', label: 'Business info' },
  { value: 'hours', label: 'Hours' },
  { value: 'reviews', label: 'Reviews & replies' },
  { value: 'photos', label: 'Photos' },
  { value: 'menu', label: 'Menu' },
  { value: 'team', label: 'Team' },
] as const

const ACTION_LABELS: Record<string, string> = {
  'restaurantVenue.updatedByOwner': 'Business details updated',
  'restaurantVenue.claimApproved': 'Ownership claim approved',
  'restaurantReviewResponse.created': 'Reply submitted',
  'restaurantReviewResponse.deleted': 'Reply removed',
  'restaurantVenuePhoto.created': 'Photos uploaded',
  'restaurantVenuePhoto.updated': 'Photo updated',
  'restaurantVenuePhoto.deleted': 'Photo deleted',
  'restaurantVenuePhoto.reordered': 'Gallery order changed',
  'restaurantVenuePhoto.coverChanged': 'Cover photo changed',
  'restaurantMenu.created': 'Menu created',
  'restaurantMenu.updated': 'Menu updated',
  'restaurantMenu.published': 'Menu published',
  'restaurantMenu.unpublished': 'Menu unpublished',
  'restaurantMenu.deleted': 'Menu deleted',
  'restaurantVenueInvite.created': 'Team invitation sent',
  'restaurantVenueInvite.revoked': 'Team invitation revoked',
  'restaurantVenueInvite.accepted': 'Teammate joined',
  'restaurantVenueMember.roleChanged': 'Role changed',
  'restaurantVenueMember.removed': 'Team member removed',
  'restaurantVenueMember.transferred': 'Ownership transferred',
}

function actionLabel(action: string): string {
  if (ACTION_LABELS[action]) return ACTION_LABELS[action]
  const parts = action.split('.')
  const verb = parts[1] || 'updated'
  return `${verb.charAt(0).toUpperCase()}${verb.replace(/([A-Z])/g, ' $1').slice(1).toLowerCase()}`
}

const DETAIL_KEYS: Array<[keyof ActivityItem['details'], string]> = [
  ['fields', 'Changed'],
  ['status', 'Status'],
  ['previousStatus', 'From'],
  ['role', 'Role'],
  ['previousRole', 'Previous role'],
  ['count', 'Count'],
  ['rating', 'Rating'],
  ['reason', 'Reason'],
]

function detailLines(details: ActivityItem['details']): string[] {
  const lines: string[] = []
  for (const [key, label] of DETAIL_KEYS) {
    const value = details[key]
    if (value == null) continue
    const text = Array.isArray(value) ? value.join(', ') : String(value)
    if (text) lines.push(`${label}: ${text}`)
  }
  return lines
}

export default function DashboardActivity() {
  const { slug = '' } = useParams<{ slug: string }>()
  const [searchParams, setSearchParams] = useSearchParams()
  const type = searchParams.get('type') || ''
  const cursor = searchParams.get('cursor') || ''
  const activity = useDashboardActivity(slug, { type: type || undefined, cursor: cursor || undefined })

  const setParam = (key: string, value: string) => {
    const next = new URLSearchParams(searchParams)
    if (value) next.set(key, value)
    else next.delete(key)
    if (key !== 'cursor') next.delete('cursor')
    setSearchParams(next)
  }

  return (
    <>
      <DashboardPageHeader
        eyebrow="Activity"
        title="Change history"
        description="A record of edits made by your team, without internal technical details."
        actions={
          <label className="rd-period">
            Activity type
            <select value={type} onChange={(event) => setParam('type', event.target.value)}>
              {TYPES.map((item) => (
                <option key={item.value} value={item.value}>
                  {item.label}
                </option>
              ))}
            </select>
          </label>
        }
      />

      <InfoNote>
        IP addresses, browser details, endpoints and internal hashes are never included in this feed.
      </InfoNote>

      {activity.isPending ? (
        <LoadingBlock label="Loading activity…" />
      ) : activity.isError ? (
        <ErrorBlock message={dashboardError(activity.error)} onRetry={() => void activity.refetch()} />
      ) : activity.data.activity.length === 0 ? (
        <EmptyState
          title="No activity in this view"
          description="Team edits will appear here as soon as someone makes a change."
        />
      ) : (
        <section className="rd-section" aria-labelledby="rd-feed-title">
          <div className="rd-section__head">
            <h2 id="rd-feed-title">Recent changes</h2>
            <span>Owned by this restaurant only</span>
          </div>
          <ol className="rd-activity-list">
            {activity.data.activity.map((item) => {
              const lines = detailLines(item.details)
              return (
                <li key={item.id} className="rd-activity-row">
                  <span className={`rd-activity-row__dot rd-activity-row__dot--${item.category}`} />
                  <div className="rd-activity-row__copy">
                    <div className="rd-activity-row__head">
                      <strong>{actionLabel(item.action)}</strong>
                      <span className={`rd-pill rd-pill--${item.category}`}>{item.category}</span>
                    </div>
                    <small>
                      {item.actor?.name || 'System'} · {formatDateTime(item.createdAt)}
                    </small>
                    {lines.length > 0 && (
                      <ul className="rd-activity-row__details">
                        {lines.map((line) => (
                          <li key={line}>{line}</li>
                        ))}
                      </ul>
                    )}
                  </div>
                </li>
              )
            })}
          </ol>

          <div className="rd-pagination">
            <span>
              Showing {activity.data.activity.length} with {activity.data.pagination.limit} per page
            </span>
            {cursor && (
              <button type="button" className="rd-button rd-button--quiet" onClick={() => setParam('cursor', '')}>
                Newest first
              </button>
            )}
            {activity.data.pagination.hasMore && activity.data.pagination.nextCursor && (
              <button
                type="button"
                className="rd-button rd-button--secondary"
                onClick={() => setParam('cursor', activity.data.pagination.nextCursor!)}
              >
                Older activity
              </button>
            )}
          </div>
        </section>
      )}
    </>
  )
}
