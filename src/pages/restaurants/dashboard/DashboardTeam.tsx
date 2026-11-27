import { useState, type FormEvent } from 'react'
import { useOutletContext, useParams } from 'react-router-dom'
import { Crown, LoaderCircle, Mail, ShieldCheck, Trash2, UserPlus } from 'lucide-react'
import { toast } from 'sonner'
import { useAuthUser } from '../../../hooks/useAuthUser'
import {
  dashboardError,
  useInviteTeamMember,
  useRemoveTeamMember,
  useRevokeTeamInvite,
  useTransferVenueOwnership,
  useUpdateTeamMemberRole,
  useVenueTeam,
  type DashboardSession,
  type TeamInvite,
  type TeamMember,
} from '../../../hooks/useRestaurantDashboard'
import {
  ConfirmDialog,
  DashboardPageHeader,
  EmptyState,
  ErrorBlock,
  InfoNote,
  LoadingBlock,
  formatDate,
  formatDateTime,
} from './components'

type PendingAction =
  | { kind: 'remove' | 'transfer' | 'demote'; member: TeamMember }
  | { kind: 'revoke'; invite: TeamInvite }

export default function DashboardTeam() {
  const { slug = '' } = useParams<{ slug: string }>()
  const session = useOutletContext<DashboardSession>()
  const user = useAuthUser()
  const team = useVenueTeam(slug)
  const invite = useInviteTeamMember(slug)
  const revoke = useRevokeTeamInvite(slug)
  const updateRole = useUpdateTeamMemberRole(slug)
  const remove = useRemoveTeamMember(slug)
  const transfer = useTransferVenueOwnership(slug)

  const [email, setEmail] = useState('')
  const [expiry, setExpiry] = useState('7')
  const [pendingAction, setPendingAction] = useState<PendingAction | null>(null)

  const canManage = session.permissions.includes('team.manage')
  const isBusy = invite.isPending || revoke.isPending || updateRole.isPending || remove.isPending || transfer.isPending

  const ask = (action: PendingAction) => setPendingAction(action)

  const confirm = () => {
    if (!pendingAction) return
    if (pendingAction.kind === 'revoke') {
      revoke.mutate(pendingAction.invite.id, {
        onSuccess: () => {
          toast.success('Invitation revoked.')
          setPendingAction(null)
        },
        onError: (error) => toast.error(dashboardError(error)),
      })
      return
    }

    const { member, kind } = pendingAction
    if (kind === 'transfer') {
      transfer.mutate(member.id, {
        onSuccess: () => {
          toast.success(`${member.user?.name || 'Your teammate'} is now the owner.`)
          setPendingAction(null)
        },
        onError: (error) => toast.error(dashboardError(error)),
      })
      return
    }
    if (kind === 'demote') {
      updateRole.mutate(
        { memberId: member.id, role: 'MANAGER' },
        {
          onSuccess: () => {
            toast.success('Role changed to manager.')
            setPendingAction(null)
          },
          onError: (error) => toast.error(dashboardError(error)),
        },
      )
      return
    }
    remove.mutate(member.id, {
      onSuccess: () => {
        toast.success('Team member removed.')
        setPendingAction(null)
      },
      onError: (error) => toast.error(dashboardError(error)),
    })
  }

  const pendingCopy = (() => {
    if (!pendingAction) return { title: '', description: '', label: '' }
    if (pendingAction.kind === 'revoke') {
      return {
        title: 'Revoke this invitation?',
        description: `The link sent to ${pendingAction.invite.email} will stop working.`,
        label: 'Revoke invitation',
      }
    }
    const { member, kind } = pendingAction
    const name = member.user?.name || member.user?.email || 'This teammate'
    if (kind === 'transfer') {
      return {
        title: 'Transfer ownership?',
        description: `${name} becomes the owner. You keep manager access, and ownership can be transferred back later.`,
        label: 'Transfer ownership',
      }
    }
    if (kind === 'demote') {
      return {
        title: 'Change owner to manager?',
        description: `${name} will lose owner-only controls, including team management.`,
        label: 'Change role',
      }
    }
    return {
      title: 'Remove this teammate?',
      description: `${name} will immediately lose access to this restaurant.`,
      label: 'Remove member',
    }
  })()

  return (
    <>
      <DashboardPageHeader
        eyebrow="Team & access"
        title="Who can manage this restaurant"
        description="Owners control access and integrations. Managers handle the day-to-day listing work."
      />

      <InfoNote>
        Invitations are tied to the email address they were sent to. The link expires after seven days
        unless a different window is chosen, and only an owner can change the team.
      </InfoNote>

      {canManage && (
        <section className="rd-section" aria-labelledby="rd-invite-title">
          <div className="rd-section__head">
            <h2 id="rd-invite-title">Invite a manager</h2>
            <span>Managers can reply, report and edit</span>
          </div>
          <form
            className="rd-invite-form"
            onSubmit={(event: FormEvent<HTMLFormElement>) => {
              event.preventDefault()
              invite.mutate(
                { email: email.trim(), expiresInDays: Number(expiry) },
                {
                  onSuccess: () => {
                    toast.success(`Invitation sent to ${email.trim()}.`)
                    setEmail('')
                  },
                  onError: (error) => toast.error(dashboardError(error)),
                },
              )
            }}
          >
            <label className="rd-field">
              Email address
              <input
                type="email"
                required
                value={email}
                maxLength={200}
                placeholder="teammate@example.com"
                onChange={(event) => setEmail(event.target.value)}
              />
            </label>
            <label className="rd-field">
              Link expires
              <select value={expiry} onChange={(event) => setExpiry(event.target.value)}>
                <option value="1">In 1 day</option>
                <option value="7">In 7 days</option>
                <option value="14">In 14 days</option>
                <option value="30">In 30 days</option>
              </select>
            </label>
            <button type="submit" className="rd-button rd-button--primary" disabled={invite.isPending || !email.trim()}>
              {invite.isPending ? <LoaderCircle size={15} className="rd-spin" /> : <UserPlus size={15} />}
              Send invitation
            </button>
          </form>
        </section>
      )}

      {team.isPending ? (
        <LoadingBlock label="Loading your team…" />
      ) : team.isError ? (
        <ErrorBlock message={dashboardError(team.error)} onRetry={() => void team.refetch()} />
      ) : (
        <>
          <section className="rd-section" aria-labelledby="rd-members-title">
            <div className="rd-section__head">
              <h2 id="rd-members-title">Team members</h2>
              <span>
                {team.data.members.length} active · {team.data.ownerCount} owner
                {team.data.ownerCount === 1 ? '' : 's'}
              </span>
            </div>
            {team.data.members.length === 0 ? (
              <EmptyState title="No team members yet" description="Invite a manager to share the work." />
            ) : (
              <div className="rd-team-list">
                {team.data.members.map((member) => {
                  const you = member.user?.id === user?.id
                  return (
                    <article key={member.id} className="rd-team-row">
                      <span className="rd-team-row__avatar">
                        {member.user?.photo ? (
                          <img src={member.user.photo} alt="" />
                        ) : (
                          (member.user?.name || member.user?.email || '?').charAt(0).toUpperCase()
                        )}
                      </span>
                      <div className="rd-team-row__who">
                        <strong>
                          {member.user?.name || member.user?.email || 'Unknown account'}
                          {you && <span className="rd-team-row__you">You</span>}
                        </strong>
                        <small>{member.user?.email || 'No email on file'}</small>
                        <small>
                          Added {formatDate(member.createdAt)} ·{' '}
                          {member.user?.lastLoginAt
                            ? `Last signed in ${formatDateTime(member.user.lastLoginAt)}`
                            : 'Never signed in'}
                        </small>
                      </div>
                      <span className={`rd-role rd-role--${member.role.toLowerCase()}`}>
                        {member.role === 'OWNER' && <Crown size={13} />}
                        {member.role === 'MANAGER' && <ShieldCheck size={13} />}
                        {member.role.charAt(0) + member.role.slice(1).toLowerCase()}
                      </span>
                      {canManage && !you && (
                        <div className="rd-team-row__actions">
                          {member.role === 'OWNER' ? (
                            team.data.ownerCount > 1 && (
                              <button type="button" onClick={() => ask({ kind: 'demote', member })}>
                                Make manager
                              </button>
                            )
                          ) : (
                            <button type="button" onClick={() => ask({ kind: 'transfer', member })}>
                              Make owner
                            </button>
                          )}
                          {(member.role === 'MANAGER' || team.data.ownerCount > 1) && (
                            <button
                              type="button"
                              className="rd-danger-link"
                              onClick={() => ask({ kind: 'remove', member })}
                            >
                              <Trash2 size={13} /> Remove
                            </button>
                          )}
                        </div>
                      )}
                    </article>
                  )
                })}
              </div>
            )}
          </section>

          {canManage && (
            <section className="rd-section" aria-labelledby="rd-invites-title">
              <div className="rd-section__head">
                <h2 id="rd-invites-title">Pending invitations</h2>
                <span>{team.data.invites.length} waiting</span>
              </div>
              {team.data.invites.length === 0 ? (
                <EmptyState
                  icon={<Mail size={20} />}
                  title="No invitations waiting"
                  description="Managers who accept an invitation appear in the team list."
                />
              ) : (
                <div className="rd-invite-list">
                  {team.data.invites.map((pendingInvite) => (
                    <article key={pendingInvite.id} className="rd-invite-row">
                      <div>
                        <strong>{pendingInvite.email}</strong>
                        <small>
                          Invited {formatDateTime(pendingInvite.createdAt)} · expires{' '}
                          {formatDate(pendingInvite.expiresAt)}
                        </small>
                      </div>
                      <span className="rd-role rd-role--manager">Manager</span>
                      <button
                        type="button"
                        className="rd-danger-link"
                        onClick={() => ask({ kind: 'revoke', invite: pendingInvite })}
                      >
                        Revoke
                      </button>
                    </article>
                  ))}
                </div>
              )}
            </section>
          )}

          <section className="rd-section rd-permissions" aria-labelledby="rd-permissions-title">
            <div className="rd-section__head">
              <h2 id="rd-permissions-title">What each role can do</h2>
            </div>
            <div className="rd-permission-grid">
              <article>
                <h3><Crown size={15} /> Owner</h3>
                <p>Everything a manager can do, plus team invitations, ownership changes, settings and connected accounts.</p>
              </article>
              <article>
                <h3><ShieldCheck size={15} /> Manager</h3>
                <p>Reply to and report reviews, upload and order photos, update hours and business information, and publish menus.</p>
              </article>
            </div>
          </section>
        </>
      )}

      {pendingAction && (
        <ConfirmDialog
          title={pendingCopy.title}
          description={pendingCopy.description}
          confirmLabel={pendingCopy.label}
          pending={isBusy}
          onConfirm={confirm}
          onCancel={() => setPendingAction(null)}
        />
      )}
    </>
  )
}
