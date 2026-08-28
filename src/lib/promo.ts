/**
 * Promo-code helpers shared by the booking widget and its tests.
 *
 * The validation contract (POST /tours/offers/validate-promo) and the pricing
 * contract (POST /travioghana/checkout/calculate) both key the travel date as
 * `travelDate` — the widget previously sent `selectedDate`, which made every
 * promo validation fail with a 400. These helpers keep the payload shape and
 * the accepted code format in one tested place.
 */

export const PROMO_CODE_MIN_LENGTH = 3
export const PROMO_CODE_MAX_LENGTH = 30

/** Codes are normalized to trimmed uppercase and must be alphanumeric. */
export function normalizePromoCode(raw: string): string {
  return (raw || '').trim().toUpperCase()
}

export function isValidPromoCodeFormat(code: string): boolean {
  return new RegExp(`^[A-Z0-9]{${PROMO_CODE_MIN_LENGTH},${PROMO_CODE_MAX_LENGTH}}$`).test(code)
}

export interface PromoValidationPayload {
  promoCode: string
  tourId: string
  travelDate: string
  quantity: number
  basePrice?: number
}

/** Body for POST /tours/offers/validate-promo — `travelDate` is required. */
export function buildPromoValidationPayload(params: {
  code: string
  tourId: string
  dateISO: string
  quantity: number
  basePrice?: number
}): PromoValidationPayload {
  return {
    promoCode: normalizePromoCode(params.code),
    tourId: params.tourId,
    travelDate: params.dateISO,
    quantity: Math.max(1, Math.floor(params.quantity)),
    ...(params.basePrice != null && Number.isFinite(params.basePrice) ? { basePrice: params.basePrice } : {}),
  }
}

/* ─── Offer eligibility against the current selection (pre-entry info) ─── */

/** Structural subset of SpecialOfferData the client-side check needs. */
export interface OfferLike {
  startDate?: string | null
  endDate?: string | null
  timeSlotMode?: 'ALL_DAYS' | 'SPECIFIC_WEEKDAYS'
  specificWeekdays?: string[]
  minQuantity?: number | null
  minSpendAmount?: number | null
}

export interface OfferEligibilitySelection {
  /** Current traveler count (the supplier's minQuantity is checked against it). */
  quantity: number
  /** Current booking subtotal before discounts (checked against minSpendAmount). */
  subtotal: number
  /** Selected travel date as YYYY-MM-DD — undefined when no date is chosen yet. */
  dateISO?: string
}

export type OfferEligibilityReason = 'window' | 'weekday' | 'quantity' | 'spend'

export interface OfferValidationResult {
  ok: boolean
  reason?: OfferEligibilityReason
}

/**
 * Client-side pre-entry eligibility of an offer against the CURRENT selection,
 * so the widget can show "Use code X — 54% off" (and any unmet condition) on
 * page load, before the traveler types anything. The server stays the ground
 * truth for the actual discount — this only decides what info to show.
 */
export function validateOfferAgainstSelection(
  offer: OfferLike,
  selection: OfferEligibilitySelection
): OfferValidationResult {
  const now = Date.now()
  if (offer.startDate && now < new Date(offer.startDate).getTime()) return { ok: false, reason: 'window' }
  if (offer.endDate && now > new Date(offer.endDate).getTime()) return { ok: false, reason: 'window' }
  if (
    offer.timeSlotMode === 'SPECIFIC_WEEKDAYS' &&
    Array.isArray(offer.specificWeekdays) &&
    offer.specificWeekdays.length > 0 &&
    selection.dateISO
  ) {
    const dayName = new Date(`${selection.dateISO}T00:00:00`)
      .toLocaleDateString('en-US', { weekday: 'long' })
      .toLowerCase()
    if (!offer.specificWeekdays.includes(dayName)) return { ok: false, reason: 'weekday' }
  }
  if (offer.minQuantity != null && selection.quantity < offer.minQuantity) return { ok: false, reason: 'quantity' }
  if (offer.minSpendAmount != null && selection.subtotal < offer.minSpendAmount) return { ok: false, reason: 'spend' }
  return { ok: true }
}
