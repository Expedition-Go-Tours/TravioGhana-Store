import { useState } from 'react'
import { Link, useOutletContext, useParams } from 'react-router-dom'
import { ArrowRight, Crown, ExternalLink, Link2, LockKeyhole, ShieldCheck } from 'lucide-react'
import { toast } from 'sonner'
import { useUpdateOwnRestaurantVenue } from '../../../hooks/useRestaurantActions'
import {
  dashboardError,
  type DashboardSession,
} from '../../../hooks/useRestaurantDashboard'
import {
  DashboardPageHeader,
  InfoNote,
  SaveBar,
  StatusBadge,
} from './components'

const EDITABLE_STATUSES = ['ACTIVE', 'PAUSED'] as const
type EditableStatus = (typeof EDITABLE_STATUSES)[number]

function isEditableStatus(value: string): value is EditableStatus {
  return (EDITABLE_STATUSES as readonly string[]).includes(value)
}

export default function DashboardSettings() {
  const { slug = '' } = useParams<{ slug: string }>()
  const session = useOutletContext<DashboardSession>()
  const update = useUpdateOwnRestaurantVenue(slug)
  const original = session.venue.status
  const [status, setStatus] = useState<EditableStatus | null>(
    isEditableStatus(original) ? original : null,
  )

  const canManageIntegrations = session.permissions.includes('integrations.manage')
  const canTransfer = session.permissions.includes('venue.transfer')
  const tripAdvisorFlagEnabled = import.meta.env.VITE_ENABLE_TRIPADVISOR_ADAPTER === 'true'
  const dirty = status != null && status !== original

  const save = () => {
    if (!status) return
    update.mutate(
      { status },
      {
        onSuccess: () => toast.success(status === 'ACTIVE' ? 'Listing is live again.' : 'Listing paused.'),
        onError: (error) => toast.error(dashboardError(error)),
      },
    )
  }

  return (
    <>
      <DashboardPageHeader
        eyebrow="Settings"
        title="Listing settings"
        description="Control whether your listing is visible, and see which connections are available."
      />

      <section className="rd-section" aria-labelledby="rd-visibility-title">
        <div className="rd-section__head">
          <h2 id="rd-visibility-title">Visibility</h2>
          <StatusBadge status={session.venue.status} />
        </div>
        <div className="rd-status-choice">
          <label className={status === 'ACTIVE' ? 'is-selected' : ''}>
            <input
              type="radio"
              name="venue-status"
              checked={status === 'ACTIVE'}
              disabled={!isEditableStatus(original)}
              onChange={() => setStatus('ACTIVE')}
            />
            <strong>Live on Travio</strong>
            <span>Diners can find the listing, its menu and its reviews.</span>
          </label>
          <label className={status === 'PAUSED' ? 'is-selected' : ''}>
            <input
              type="radio"
              name="venue-status"
              checked={status === 'PAUSED'}
              disabled={!isEditableStatus(original)}
              onChange={() => setStatus('PAUSED')}
            />
            <strong>Paused</strong>
            <span>The listing leaves public results. You can still edit everything here.</span>
          </label>
        </div>
        {!isEditableStatus(original) && (
          <InfoNote>
            This listing is {original.toLowerCase()}. Draft and closed listings can only be changed by
            the Travio team.
          </InfoNote>
        )}
        <SaveBar
          dirty={dirty}
          pending={update.isPending}
          onSave={save}
          note="Visibility changes take effect as soon as you save."
        />
      </section>

      <section className="rd-section" aria-labelledby="rd-integrations-title">
        <div className="rd-section__head">
          <h2 id="rd-integrations-title">Connected accounts</h2>
          <span>Owner only</span>
        </div>
        {canManageIntegrations ? (
          <div className="rd-integration">
            <span className="rd-integration__mark">TA</span>
            <div className="rd-integration__copy">
              <strong>Tripadvisor</strong>
              <p>
                Optional reply and report adapter. Listing content, photos, hours and menus are managed
                here on Travio; Tripadvisor never becomes the source of truth.
              </p>
              <p className="rd-integration__state">
                <LockKeyhole size={13} /> Not connected. Activation needs a Terra API key, OAuth client
                and redirect URIs, granted scopes, and allowlisted location IDs.
              </p>
              <button type="button" className="rd-button rd-button--quiet" disabled>
                <Link2 size={14} /> Connect Tripadvisor
              </button>
            </div>
            <span className="rd-pill rd-pill--draft">
              {tripAdvisorFlagEnabled ? 'Configuration required' : 'Not enabled'}
            </span>
          </div>
        ) : (
          <InfoNote>
            <ShieldCheck size={15} /> Only the owner can manage connected accounts.
          </InfoNote>
        )}
      </section>

      <section className="rd-section" aria-labelledby="rd-ownership-title">
        <div className="rd-section__head">
          <h2 id="rd-ownership-title">Ownership</h2>
          <span>Owner only</span>
        </div>
        {canTransfer ? (
          <div className="rd-setting-row">
            <div>
              <strong><Crown size={14} /> Transfer ownership</strong>
              <p>Hand this listing to another team member. You keep manager access.</p>
            </div>
            <Link className="rd-button rd-button--secondary" to={`/restaurants/${slug}/manage/team`}>
              Open team <ArrowRight size={14} />
            </Link>
          </div>
        ) : (
          <InfoNote>Only the owner can transfer this restaurant.</InfoNote>
        )}
      </section>

      <section className="rd-section" aria-labelledby="rd-about-title">
        <div className="rd-section__head">
          <h2 id="rd-about-title">About this dashboard</h2>
        </div>
        <div className="rd-setting-row">
          <div>
            <strong>Your access</strong>
            <p>
              {session.membership.role.charAt(0) + session.membership.role.slice(1).toLowerCase()} ·{' '}
              {session.permissions.length} permissions
            </p>
          </div>
          <a
            className="rd-button rd-button--quiet"
            href={`/restaurants/${slug}`}
            target="_blank"
            rel="noreferrer"
          >
            Public listing <ExternalLink size={13} />
          </a>
        </div>
      </section>
    </>
  )
}
