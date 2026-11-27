import { useState, type ReactNode } from 'react'
import { Link, NavLink } from 'react-router-dom'
import {
  AlertCircle,
  ArrowLeft,
  BarChart3,
  Building2,
  Check,
  ChevronRight,
  Clock3,
  ExternalLink,
  GripVertical,
  History,
  Image as ImageIcon,
  Info,
  LayoutDashboard,
  LoaderCircle,
  Menu as MenuIcon,
  MessageSquare,
  Plus,
  Send,
  Settings2,
  ShieldCheck,
  Star,
  Trash2,
  UploadCloud,
  Users,
  UtensilsCrossed,
  X,
} from 'lucide-react'
import OptimizedImage from '../../../components/shared/OptimizedImage'
import type {
  AttentionItem,
  DashboardSession,
  OwnerReview,
  Permission,
  PhotoStatus,
  VenuePhoto,
} from '../../../hooks/useRestaurantDashboard'

/* ── navigation ─────────────────────────────────────────────────────────── */

interface NavItem {
  to: string
  label: string
  icon: ReactNode
  permission?: Permission
  badge?: keyof NonNullable<DashboardSession['badges']>
}

export const DASHBOARD_NAV: NavItem[] = [
  { to: '', label: 'Overview', icon: <LayoutDashboard size={17} /> },
  { to: 'reviews', label: 'Reviews', icon: <MessageSquare size={17} />, badge: 'reviews' },
  { to: 'photos', label: 'Photos', icon: <ImageIcon size={17} />, badge: 'photos' },
  { to: 'hours', label: 'Hours', icon: <Clock3 size={17} /> },
  { to: 'business-info', label: 'Business info', icon: <Building2 size={17} /> },
  { to: 'menu', label: 'Menu', icon: <UtensilsCrossed size={17} /> },
  { to: 'team', label: 'Team & access', icon: <Users size={17} />, permission: 'team.view' },
  { to: 'insights', label: 'Insights', icon: <BarChart3 size={17} /> },
  { to: 'activity', label: 'Activity', icon: <History size={17} /> },
  { to: 'settings', label: 'Settings', icon: <Settings2 size={17} />, permission: 'team.view' },
]

export function DashboardSidebar({
  slug,
  session,
  open,
  onClose,
}: {
  slug: string
  session: DashboardSession
  open: boolean
  onClose: () => void
}) {
  const items = DASHBOARD_NAV.filter(
    (item) => !item.permission || session.permissions.includes(item.permission),
  )

  return (
    <>
      {open && <button className="rd-scrim" type="button" aria-label="Close menu" onClick={onClose} />}
      <aside className={`rd-sidebar${open ? ' rd-sidebar--open' : ''}`} aria-label="Dashboard navigation">
        <div className="rd-sidebar__head">
          <Link to="/restaurants/manage" className="rd-sidebar__back">
            <ArrowLeft size={14} /> My restaurants
          </Link>
          <button className="rd-sidebar__close" type="button" aria-label="Close menu" onClick={onClose}>
            <X size={18} />
          </button>
        </div>

        <div className="rd-sidebar__venue">
          <span className="rd-sidebar__avatar">
            {session.venue.coverPhoto ? (
              <OptimizedImage
                src={session.venue.coverPhoto}
                alt=""
                width={40}
                height={40}
                fit="crop"
              />
            ) : (
              session.venue.name.charAt(0)
            )}
          </span>
          <span className="rd-sidebar__venue-copy">
            <strong>{session.venue.name}</strong>
            <small>{session.venue.city || 'Ghana'}</small>
          </span>
        </div>

        <nav className="rd-sidebar__nav">
          {items.map((item) => {
            const badge = item.badge ? session.badges?.[item.badge] || 0 : 0
            return (
              <NavLink
                key={item.to}
                to={`/restaurants/${slug}/manage${item.to ? `/${item.to}` : ''}`}
                end={!item.to}
                className={({ isActive }) => `rd-navitem${isActive ? ' rd-navitem--active' : ''}`}
                onClick={onClose}
              >
                <span className="rd-navitem__icon">{item.icon}</span>
                <span>{item.label}</span>
                {badge > 0 && <span className="rd-navitem__badge">{badge > 99 ? '99+' : badge}</span>}
              </NavLink>
            )
          })}
        </nav>

        <div className="rd-sidebar__foot">
          <ShieldCheck size={15} />
          <span>
            <strong>{session.membership.role.toLowerCase()} access</strong>
            <small>Edits are logged for the Travio team.</small>
          </span>
        </div>
      </aside>
    </>
  )
}

export function DashboardTopbar({
  slug,
  session,
  onMenu,
}: {
  slug: string
  session: DashboardSession
  onMenu: () => void
}) {
  return (
    <header className="rd-topbar">
      <button className="rd-topbar__menu" type="button" aria-label="Open menu" onClick={onMenu}>
        <MenuIcon size={20} />
      </button>
      <nav className="rh-breadcrumb rd-topbar__crumb" aria-label="Breadcrumb">
        <Link to="/restaurants/manage">My restaurants</Link>
        <ChevronRight size={13} aria-hidden="true" />
        <span>{session.venue.name}</span>
      </nav>
      <div className="rd-topbar__actions">
        <StatusBadge status={session.venue.status} />
        <a
          className="rd-topbar__view"
          href={`/restaurants/${slug}`}
          target="_blank"
          rel="noreferrer"
        >
          View listing <ExternalLink size={13} aria-hidden="true" />
        </a>
      </div>
    </header>
  )
}

/* ── primitives ─────────────────────────────────────────────────────────── */

export function DashboardPageHeader({
  eyebrow,
  title,
  description,
  actions,
}: {
  eyebrow?: string
  title: string
  description?: string
  actions?: ReactNode
}) {
  return (
    <header className="rd-pagehead">
      <div>
        {eyebrow && <span className="rd-eyebrow">{eyebrow}</span>}
        <h1>{title}</h1>
        {description && <p>{description}</p>}
      </div>
      {actions && <div className="rd-pagehead__actions">{actions}</div>}
    </header>
  )
}

export function StatusBadge({ status }: { status: DashboardSession['venue']['status'] }) {
  const label = status.charAt(0) + status.slice(1).toLowerCase()
  return <span className={`rd-status rd-status--${status.toLowerCase()}`}>{label}</span>
}

export function StatusPill({ status }: { status: PhotoStatus | 'DRAFT' | 'PUBLISHED' | string }) {
  return <span className={`rd-pill rd-pill--${status.toLowerCase()}`}>{titleCase(status)}</span>
}

export function MetricCard({
  label,
  value,
  hint,
  tone,
}: {
  label: string
  value: ReactNode
  hint?: string
  tone?: 'warn' | 'good'
}) {
  return (
    <article className={`rd-metric${tone ? ` rd-metric--${tone}` : ''}`}>
      <span className="rd-metric__label">{label}</span>
      <strong className="rd-metric__value">{value}</strong>
      {hint && <small className="rd-metric__hint">{hint}</small>}
    </article>
  )
}

export function AttentionRow({ item, slug }: { item: AttentionItem; slug: string }) {
  const Icon = item.tone === 'warn' ? AlertCircle : Info
  const target = `/restaurants/${slug}/manage/${item.action.to}${
    item.action.filter ? `?filter=${encodeURIComponent(item.action.filter)}` : ''
  }`
  return (
    <article className={`rd-attention rd-attention--${item.tone}`}>
      <span className="rd-attention__icon">
        <Icon size={17} />
      </span>
      <div className="rd-attention__copy">
        <strong>{item.title}</strong>
        <p>{item.detail}</p>
      </div>
      <Link to={target}>
        {item.action.label} <ChevronRight size={14} />
      </Link>
    </article>
  )
}

export function EmptyState({
  icon,
  title,
  description,
  action,
}: {
  icon?: ReactNode
  title: string
  description?: string
  action?: ReactNode
}) {
  return (
    <div className="rd-empty">
      <span className="rd-empty__icon">{icon || <Info size={22} />}</span>
      <strong>{title}</strong>
      {description && <p>{description}</p>}
      {action}
    </div>
  )
}

export function LoadingBlock({ label = 'Loading…' }: { label?: string }) {
  return (
    <div className="rd-loading" role="status">
      <LoaderCircle size={18} className="rd-spin" /> {label}
    </div>
  )
}

export function ErrorBlock({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="rd-error" role="alert">
      <AlertCircle size={20} />
      <div>
        <strong>We could not load this page</strong>
        <p>{message}</p>
      </div>
      {onRetry && <button type="button" onClick={onRetry}>Try again</button>}
    </div>
  )
}

export function ConfirmDialog({
  title,
  description,
  confirmLabel = 'Confirm',
  pending,
  onConfirm,
  onCancel,
}: {
  title: string
  description: string
  confirmLabel?: string
  pending?: boolean
  onConfirm: () => void
  onCancel: () => void
}) {
  return (
    <div className="rd-modal" role="dialog" aria-modal="true" aria-label={title}>
      <button className="rd-modal__scrim" type="button" aria-label="Close" onClick={onCancel} />
      <div className="rd-modal__card">
        <h2>{title}</h2>
        <p>{description}</p>
        <div className="rd-modal__actions">
          <button type="button" className="rd-button rd-button--quiet" onClick={onCancel}>
            Cancel
          </button>
          <button
            type="button"
            className="rd-button rd-button--danger"
            disabled={pending}
            onClick={onConfirm}
          >
            {pending ? <LoaderCircle size={15} className="rd-spin" /> : <Check size={15} />}
            {pending ? 'Working…' : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}

export function SaveBar({
  dirty,
  pending,
  onSave,
  note = 'Changes publish as soon as you save.',
}: {
  dirty: boolean
  pending: boolean
  onSave: () => void
  note?: string
}) {
  return (
    <div className="rd-savebar">
      <span>
        <ShieldCheck size={15} /> {note}
      </span>
      <button type="button" className="rd-button rd-button--primary" disabled={!dirty || pending} onClick={onSave}>
        {pending ? <LoaderCircle size={15} className="rd-spin" /> : <Check size={15} />}
        {pending ? 'Saving…' : 'Save changes'}
      </button>
    </div>
  )
}

/* ── reviews ────────────────────────────────────────────────────────────── */

export function Stars({ rating, size = 13 }: { rating: number; size?: number }) {
  return (
    <span className="rd-stars" aria-label={`${rating} out of 5 stars`}>
      {[1, 2, 3, 4, 5].map((value) => (
        <Star key={value} size={size} fill={value <= rating ? 'currentColor' : 'none'} />
      ))}
    </span>
  )
}

function titleCase(value: string): string {
  const text = value.toLowerCase()
  return text.charAt(0).toUpperCase() + text.slice(1)
}

export function formatDate(value: string | null): string {
  if (!value) return '—'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '—'
  return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}

export function formatDateTime(value: string | null): string {
  if (!value) return '—'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '—'
  return date.toLocaleString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export function formatMoney(minor: number | null, currency: string): string {
  if (minor == null) return 'Market price'
  return new Intl.NumberFormat('en-GH', {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
  }).format(minor / 100)
}

export function ReplyComposer({
  reviewId,
  initialBody = '',
  pending,
  onSubmit,
  onCancel,
}: {
  reviewId: string
  initialBody?: string
  pending: boolean
  onSubmit: (body: string) => void
  onCancel?: () => void
}) {
  const [body, setBody] = useState(initialBody)
  const tooShort = body.trim().length > 0 && body.trim().length < 20
  const tooLong = body.length > 2000

  return (
    <form
      className="rd-reply"
      onSubmit={(event) => {
        event.preventDefault()
        if (body.trim().length >= 20 && body.length <= 2000) onSubmit(body.trim())
      }}
    >
      <label htmlFor={`reply-${reviewId}`}>Your reply</label>
      <textarea
        id={`reply-${reviewId}`}
        value={body}
        onChange={(event) => setBody(event.target.value)}
        rows={4}
        maxLength={2000}
        placeholder="Thank the diner and address what happened. Keep it specific."
      />
      <div className="rd-reply__foot">
        <small>
          Links and email addresses are not allowed. Replies go to the Travio team before they appear
          publicly.
        </small>
        <span className={tooShort || tooLong ? 'rd-counter rd-counter--bad' : 'rd-counter'}>
          {body.length} / 2000
        </span>
      </div>
      <div className="rd-reply__actions">
        {onCancel && (
          <button type="button" className="rd-button rd-button--quiet" onClick={onCancel}>
            Cancel
          </button>
        )}
        <button
          type="submit"
          className="rd-button rd-button--primary"
          disabled={pending || body.trim().length < 20 || tooLong}
        >
          <Send size={14} /> {pending ? 'Sending…' : 'Send reply'}
        </button>
      </div>
    </form>
  )
}

export function ReviewCard({
  review,
  canReply,
  replyPending,
  onReply,
  deletePending,
  onDeleteReply,
}: {
  review: OwnerReview
  canReply: boolean
  replyPending: boolean
  onReply: (body: string) => void
  deletePending: boolean
  onDeleteReply: (responseId: string) => void
}) {
  const [composing, setComposing] = useState(false)
  const response = review.response

  return (
    <article className="rd-review">
      <header className="rd-review__head">
        <span className="rd-review__avatar">
          {review.author?.photo ? (
            <OptimizedImage
              src={review.author.photo}
              alt=""
              width={36}
              height={36}
              fit="crop"
            />
          ) : (
            (review.author?.name || 'D').charAt(0).toUpperCase()
          )}
        </span>
        <span className="rd-review__who">
          <strong>{review.author?.name || 'Travio diner'}</strong>
          <small>
            <Stars rating={review.rating} /> {formatDate(review.createdAt)}
            {review.verified && <span className="rd-review__verified">Verified visit</span>}
          </small>
        </span>
        {review.rating <= 3 && <span className="rd-review__flag">Needs attention</span>}
      </header>

      <h3>{review.title || 'Untitled review'}</h3>
      {review.body && <p className="rd-review__body">{review.body}</p>}
      {review.photos.length > 0 && (
        <div className="rd-review__photos">
          {review.photos.map((photo) => (
            <OptimizedImage key={photo} src={photo} alt="" width={80} height={64} fit="crop" />
          ))}
        </div>
      )}

      {response ? (
        <div className="rd-review__response">
          <div className="rd-review__response-head">
            <strong>Your reply</strong>
            <StatusPill status={response.status} />
          </div>
          <p>{response.body}</p>
          <small>
            {response.authorName || 'Your team'} · {formatDateTime(response.createdAt)}
            {response.status === 'REJECTED' && response.flagReason
              ? ` · ${response.flagReason}`
              : ''}
          </small>
          {canReply && response.status !== 'REMOVED' && (
            <div className="rd-review__response-actions">
              <button type="button" onClick={() => setComposing(true)}>
                Replace reply
              </button>
              <button
                type="button"
                className="rd-danger-link"
                disabled={deletePending}
                onClick={() => onDeleteReply(response.id)}
              >
                <Trash2 size={13} /> Remove
              </button>
            </div>
          )}
        </div>
      ) : (
        canReply && (
          <button
            type="button"
            className="rd-button rd-button--secondary"
            onClick={() => setComposing(true)}
          >
            <MessageSquare size={14} /> Reply to this review
          </button>
        )
      )}

      {composing && (
        <ReplyComposer
          reviewId={review.id}
          initialBody={response?.status === 'REJECTED' ? response.body : ''}
          pending={replyPending}
          onSubmit={(body) => {
            onReply(body)
            setComposing(false)
          }}
          onCancel={() => setComposing(false)}
        />
      )}
    </article>
  )
}

/* ── photos ─────────────────────────────────────────────────────────────── */

export function PhotoUploader({
  pending,
  onUpload,
  disabled,
}: {
  pending: boolean
  onUpload: (files: File[]) => void
  disabled?: boolean
}) {
  const [dragging, setDragging] = useState(false)

  return (
    <label
      className={`rd-uploader${dragging ? ' rd-uploader--dragging' : ''}`}
      onDragOver={(event) => {
        event.preventDefault()
        setDragging(true)
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={(event) => {
        event.preventDefault()
        setDragging(false)
        const files = Array.from(event.dataTransfer.files).filter((file) => file.type.startsWith('image/'))
        if (files.length) onUpload(files.slice(0, 10))
      }}
    >
      <input
        type="file"
        accept="image/*"
        multiple
        disabled={disabled || pending}
        onChange={(event) => {
          const files = Array.from(event.target.files || [])
          if (files.length) onUpload(files.slice(0, 10))
          event.target.value = ''
        }}
      />
      <UploadCloud size={24} />
      <strong>{pending ? 'Uploading…' : 'Add photos'}</strong>
      <span>Drag images here or choose up to 10 at a time. New photos wait for review.</span>
    </label>
  )
}

export function PhotoGrid({
  photos,
  coverPhoto,
  canManage,
  reorderPending,
  onReorder,
  onCover,
  onCaption,
  onDelete,
}: {
  photos: VenuePhoto[]
  coverPhoto: string | null
  canManage: boolean
  reorderPending: boolean
  onReorder: (ids: string[]) => void
  onCover: (photoId: string) => void
  onCaption: (photo: VenuePhoto) => void
  onDelete: (photoId: string) => void
}) {
  const [editing, setEditing] = useState<string | null>(null)
  const [caption, setCaption] = useState('')

  const move = (index: number, direction: -1 | 1) => {
    const next = photos.slice()
    const target = index + direction
    if (target < 0 || target >= next.length) return
    ;[next[index], next[target]] = [next[target], next[index]]
    onReorder(next.map((row) => row.id))
  }

  return (
    <div className="rd-photogrid">
      {photos.map((photo, index) => (
        <article key={photo.id} className="rd-photocard">
          <div className="rd-photocard__image">
            <OptimizedImage src={photo.url} alt={photo.caption || ''} width={260} height={190} fit="crop" />
            {coverPhoto === photo.url && <span className="rd-photocard__cover">Cover</span>}
            <StatusPill status={photo.status} />
          </div>
          <div className="rd-photocard__body">
            {editing === photo.id ? (
              <form
                onSubmit={(event) => {
                  event.preventDefault()
                  onCaption({ ...photo, caption })
                  setEditing(null)
                }}
              >
                <input
                  aria-label={`Caption for photo ${index + 1}`}
                  value={caption}
                  maxLength={200}
                  onChange={(event) => setCaption(event.target.value)}
                  placeholder="Describe this photo"
                />
                <button type="submit">Save</button>
              </form>
            ) : (
              <p>{photo.caption || <em>No caption yet</em>}</p>
            )}
            {photo.status === 'REJECTED' && photo.flagReason && (
              <small className="rd-photocard__reason">{photo.flagReason}</small>
            )}
            {canManage && (
              <div className="rd-photocard__actions">
                <button type="button" aria-label="Move earlier" disabled={index === 0 || reorderPending} onClick={() => move(index, -1)}>
                  <ArrowLeft size={14} />
                </button>
                <button type="button" aria-label="Move later" disabled={index === photos.length - 1 || reorderPending} onClick={() => move(index, 1)}>
                  <ChevronRight size={14} />
                </button>
                <button
                  type="button"
                  disabled={photo.status !== 'PUBLISHED' || coverPhoto === photo.url}
                  onClick={() => onCover(photo.id)}
                >
                  Make cover
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setEditing(photo.id)
                    setCaption(photo.caption || '')
                  }}
                >
                  Caption
                </button>
                <button type="button" className="rd-danger-link" onClick={() => onDelete(photo.id)}>
                  <Trash2 size={14} />
                </button>
              </div>
            )}
          </div>
          <span className="rd-photocard__grip" aria-hidden="true">
            <GripVertical size={14} />
          </span>
        </article>
      ))}
    </div>
  )
}

/* ── small shared bits ──────────────────────────────────────────────────── */

export function AddButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button type="button" className="rd-button rd-button--secondary" onClick={onClick}>
      <Plus size={15} /> {label}
    </button>
  )
}

export function InfoNote({ children }: { children: ReactNode }) {
  return (
    <div className="rd-note">
      <Info size={16} /> <span>{children}</span>
    </div>
  )
}
