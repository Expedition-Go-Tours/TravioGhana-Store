import { describe, it, expect } from 'vitest'
import {
  buildPromoValidationPayload,
  isValidPromoCodeFormat,
  normalizePromoCode,
  validateOfferAgainstSelection,
  type OfferLike,
} from './promo'

describe('promo code helpers', () => {
  it('builds the validation payload with the travelDate key the backend requires', () => {
    const payload = buildPromoValidationPayload({
      code: '  spring25 ',
      tourId: 'tour-1',
      dateISO: '2026-08-25',
      quantity: 2,
      basePrice: 500,
    })
    expect(payload).toEqual({
      promoCode: 'SPRING25',
      tourId: 'tour-1',
      travelDate: '2026-08-25',
      quantity: 2,
      basePrice: 500,
    })
    // Regression guard: the widget previously sent `selectedDate`, which the
    // backend rejects — the key must be `travelDate`.
    expect(payload.travelDate).toBeDefined()
    expect('selectedDate' in payload).toBe(false)
  })

  it('omits basePrice when it is missing or not a number', () => {
    expect(buildPromoValidationPayload({ code: 'A1', tourId: 't', dateISO: '2026-08-25', quantity: 1 })).toEqual({
      promoCode: 'A1',
      tourId: 't',
      travelDate: '2026-08-25',
      quantity: 1,
    })
    expect(buildPromoValidationPayload({ code: 'A1', tourId: 't', dateISO: '2026-08-25', quantity: 1, basePrice: Number.NaN })).toEqual({
      promoCode: 'A1',
      tourId: 't',
      travelDate: '2026-08-25',
      quantity: 1,
    })
  })

  it('clamps quantity to a positive integer', () => {
    expect(buildPromoValidationPayload({ code: 'A1', tourId: 't', dateISO: '2026-08-25', quantity: 0 }).quantity).toBe(1)
    expect(buildPromoValidationPayload({ code: 'A1', tourId: 't', dateISO: '2026-08-25', quantity: -3 }).quantity).toBe(1)
  })

  it('accepts 3–30 character uppercase alphanumeric codes only', () => {
    expect(isValidPromoCodeFormat('SAVE10')).toBe(true)
    expect(isValidPromoCodeFormat('abc')).toBe(false) // not normalized
    expect(isValidPromoCodeFormat('SAVE10!')).toBe(false) // punctuation
    expect(isValidPromoCodeFormat('AB')).toBe(false) // too short
    expect(isValidPromoCodeFormat('A'.repeat(31))).toBe(false) // too long
    expect(isValidPromoCodeFormat('A'.repeat(30))).toBe(true)
  })

  it('normalizes codes to trimmed uppercase', () => {
    expect(normalizePromoCode('  save10 ')).toBe('SAVE10')
    expect(normalizePromoCode('')).toBe('')
  })
})

describe('validateOfferAgainstSelection', () => {
  const baseOffer: OfferLike = {
    startDate: null,
    endDate: null,
    timeSlotMode: 'ALL_DAYS',
    specificWeekdays: [],
    minQuantity: null,
    minSpendAmount: null,
  }
  const sel = { quantity: 2, subtotal: 500 }

  it('passes an offer with no conditions', () => {
    expect(validateOfferAgainstSelection(baseOffer, sel)).toEqual({ ok: true })
  })

  it('rejects an offer outside its date window', () => {
    expect(validateOfferAgainstSelection({ ...baseOffer, endDate: '2026-01-01T00:00:00.000Z' }, sel)).toEqual({ ok: false, reason: 'window' })
    expect(validateOfferAgainstSelection({ ...baseOffer, startDate: '2099-01-01T00:00:00.000Z' }, sel)).toEqual({ ok: false, reason: 'window' })
  })

  it('rejects a weekday the selected date does not match', () => {
    const monFri = { ...baseOffer, timeSlotMode: 'SPECIFIC_WEEKDAYS' as const, specificWeekdays: ['monday', 'friday'] }
    expect(validateOfferAgainstSelection(monFri, { ...sel, dateISO: '2026-08-24' })).toEqual({ ok: true }) // Monday
    expect(validateOfferAgainstSelection(monFri, { ...sel, dateISO: '2026-08-25' })).toEqual({ ok: false, reason: 'weekday' }) // Tuesday
    expect(validateOfferAgainstSelection(monFri, { ...sel, dateISO: '2026-08-29' })).toEqual({ ok: false, reason: 'weekday' }) // Saturday
  })

  it('skips the weekday check when no date is selected yet', () => {
    expect(validateOfferAgainstSelection({ ...baseOffer, timeSlotMode: 'SPECIFIC_WEEKDAYS', specificWeekdays: ['monday'] }, sel)).toEqual({ ok: true })
  })

  it('rejects when the traveler count is below the minimum quantity', () => {
    expect(validateOfferAgainstSelection({ ...baseOffer, minQuantity: 3 }, sel)).toEqual({ ok: false, reason: 'quantity' })
    expect(validateOfferAgainstSelection({ ...baseOffer, minQuantity: 2 }, sel)).toEqual({ ok: true })
  })

  it('rejects when the subtotal is below the minimum spend', () => {
    expect(validateOfferAgainstSelection({ ...baseOffer, minSpendAmount: 600 }, sel)).toEqual({ ok: false, reason: 'spend' })
    expect(validateOfferAgainstSelection({ ...baseOffer, minSpendAmount: 500 }, sel)).toEqual({ ok: true })
  })

  it('reports the first unmet condition only', () => {
    expect(validateOfferAgainstSelection({ ...baseOffer, minQuantity: 3, minSpendAmount: 600 }, sel)).toEqual({ ok: false, reason: 'quantity' })
  })
})
