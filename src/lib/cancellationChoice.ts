import { apiFetch } from './api'

/**
 * Customer-facing "supplier cancelled your booking — choose a new date or a
 * full refund" flow (GetYourGuide-parity Phase 2).
 *
 * Backend contract (final):
 *  - GET  /api/bookings/cancellation-choice/:token  -> preview payload
 *  - POST /api/bookings/cancellation-choice         -> { token, choice }
 *  400 responses carry `{ message }`, which must be shown verbatim.
 *
 * Both go through `apiFetch`, which unwraps `payload.data ?? payload` and
 * throws an ApiError whose message is the backend's own `message` string.
 */

export type CancellationChoice = 'REFUND' | 'RESCHEDULE'

export type ResolvedStatus =
  | 'PENDING_CHOICE'
  | 'RESCHEDULED'
  | 'REFUND_PENDING'
  | 'REFUNDED'
  | 'CLOSED'

export type RefundStatus = 'PENDING' | 'PROCESSING' | 'SUCCEEDED' | 'NOT_APPLICABLE'

export interface CancellationChoicePreview {
  token: string
  bookingNumber?: string
  tourTitle?: string
  tourSlug?: string
  coverPhoto?: string | null
  travelDate?: string | null
  selectedTime?: string | null
  refundAmount?: number | null
  currency?: string | null
  /** ISO timestamp. */
  choiceDeadline?: string | null
  resolvedStatus?: ResolvedStatus | string | null
  customerChoice?: CancellationChoice | null
  refundStatus?: RefundStatus | string | null
  choiceWindowHours?: number | null
  /** Present when there is nothing to refund (e.g. unpaid booking). */
  nothingToRefund?: boolean
}

/** Cancellation-choice fields attached to each booking list record. */
export interface BookingCancellationChoiceFields {
  cancellationChoiceToken?: string | null
  cancellationChoiceDeadline?: string | null
  customerChoice?: CancellationChoice | null
  refundStatus?: RefundStatus | string | null
  cancellationReason?: string | null
  refundAmount?: number | null
}

export interface CancellationChoiceSuccess {
  ok?: boolean
  bookingNumber?: string
  bookingId?: string
  newTravelDate?: string | null
  refundAmount?: number | null
  currency?: string | null
  refundStatus?: RefundStatus | string | null
  message?: string
}

/** GET the preview for a cancellation-choice token. */
export function fetchCancellationChoicePreview(
  token: string,
  signal?: AbortSignal
): Promise<CancellationChoicePreview> {
  return apiFetch<CancellationChoicePreview>(
    `/bookings/cancellation-choice/${encodeURIComponent(token)}`,
    { method: 'GET', signal }
  )
}

/** POST the customer's decision — refund, or reschedule to a new date. */
export function submitCancellationChoice(input: {
  token: string
  choice: CancellationChoice
  newTravelDate?: string
}): Promise<CancellationChoiceSuccess> {
  const body: Record<string, string> = { token: input.token, choice: input.choice }
  if (input.choice === 'RESCHEDULE') body.newTravelDate = input.newTravelDate ?? ''

  return apiFetch<CancellationChoiceSuccess>('/bookings/cancellation-choice', {
    method: 'POST',
    body: JSON.stringify(body),
  })
}

/** Backend `{ message }` verbatim, or a generic fallback for non-Error throws. */
export function choiceErrorMessage(err: unknown): string {
  if (err instanceof Error && err.message) return err.message
  return 'Something went wrong. Please try again.'
}

/* ------------------------------------------------------------------ */
/* Formatting helpers — kept out of components because reading the
   clock during render trips the react-hooks/purity rule.             */
/* ------------------------------------------------------------------ */

/** "31 Dec 2026" — falls back to the raw value when unparseable. */
export function formatChoiceDate(value?: string | null): string {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}

/** "31 Dec 2026, 18:00" for choice deadlines. */
export function formatChoiceDeadline(value?: string | null): string {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return `${formatChoiceDate(value)}, ${date.toLocaleTimeString('en-GB', {
    hour: '2-digit',
    minute: '2-digit',
  })}`
}

/** Money for banner/dialog copy: "150.00 GHS". */
export function formatChoiceAmount(amount?: number | null, currency?: string | null): string {
  if (amount == null) return ''
  const value = amount.toLocaleString('en-GB', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
  return currency ? `${value} ${currency}` : value
}

/** Compact urgency label, e.g. "18 hours left" / "2 days left". */
export function hoursLeftLabel(deadline?: string | null): string {
  if (!deadline) return ''
  const end = new Date(deadline).getTime()
  if (Number.isNaN(end)) return ''
  const diff = end - Date.now()
  if (diff <= 0) return 'Deadline passed'
  const hours = diff / 3_600_000
  if (hours < 1) return 'Less than an hour left'
  if (hours < 48) {
    const rounded = Math.ceil(hours)
    return `${rounded} ${rounded === 1 ? 'hour' : 'hours'} left`
  }
  const days = Math.ceil(hours / 24)
  return `${days} days left`
}

/** Earliest selectable reschedule date (tomorrow, local time) as YYYY-MM-DD. */
export function minRescheduleDate(): string {
  const d = new Date()
  d.setDate(d.getDate() + 1)
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
}

/** Whether the choice deadline is still in the future. */
export function isChoiceDeadlineOpen(deadline?: string | null): boolean {
  if (!deadline) return false
  const end = new Date(deadline).getTime()
  if (Number.isNaN(end)) return false
  return end > Date.now()
}

/**
 * Refund option status wording, driven by refundStatus:
 * PENDING -> "will be processed", PROCESSING -> "is being processed",
 * SUCCEEDED -> "has been refunded",
 * NOT_APPLICABLE / nothingToRefund -> "no payment was taken".
 */
export function refundStatusText(
  preview: Pick<CancellationChoicePreview, 'refundStatus' | 'nothingToRefund'>
): string {
  if (preview.nothingToRefund || preview.refundStatus === 'NOT_APPLICABLE') {
    return 'No payment was taken for this booking, so there is nothing to refund.'
  }
  switch (preview.refundStatus) {
    case 'PROCESSING':
      return 'Your refund is being processed.'
    case 'SUCCEEDED':
      return 'Your refund has been refunded to your original payment method.'
    case 'PENDING':
    default:
      return 'Your refund will be processed to your original payment method.'
  }
}
