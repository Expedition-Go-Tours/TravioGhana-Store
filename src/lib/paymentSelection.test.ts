import { describe, expect, it } from 'vitest'
import { resolveMethod, resolveTiming } from './paymentSelection'

describe('resolveTiming', () => {
  it('defaults to paying now when nothing was chosen', () => {
    expect(resolveTiming(undefined, true)).toBe('now')
    expect(resolveTiming(null, true)).toBe('now')
    expect(resolveTiming('', true)).toBe('now')
  })

  it('keeps pay-later when the customer chose it and the date allows it', () => {
    expect(resolveTiming('later', true)).toBe('later')
  })

  it('falls back to paying now when the date is inside the pay-later window', () => {
    expect(resolveTiming('later', false)).toBe('now')
  })

  it('ignores values that are not a known timing', () => {
    expect(resolveTiming('paypal', true)).toBe('now')
    expect(resolveTiming('nonsense', true)).toBe('now')
    expect(resolveTiming('NOW', true)).toBe('now')
  })
})

describe('resolveMethod', () => {
  it('defaults to card when nothing was chosen', () => {
    expect(resolveMethod(undefined, true)).toBe('card')
    expect(resolveMethod(null, true)).toBe('card')
    expect(resolveMethod('', true)).toBe('card')
  })

  it('keeps PayPal when the customer chose it and the server offers it', () => {
    expect(resolveMethod('paypal', true)).toBe('paypal')
  })

  it('falls back to card when PayPal stops being available', () => {
    expect(resolveMethod('paypal', false)).toBe('card')
  })

  it('keeps an explicit card choice', () => {
    expect(resolveMethod('card', true)).toBe('card')
    expect(resolveMethod('card', false)).toBe('card')
  })

  it('ignores values that are not a known method', () => {
    expect(resolveMethod('later', true)).toBe('card')
    expect(resolveMethod('stripe', true)).toBe('card')
    expect(resolveMethod('PAYPAL', true)).toBe('card')
  })
})

describe('timing and method are independent', () => {
  it('does not let PayPal selection change the timing', () => {
    expect(resolveTiming('now', true)).toBe('now')
    expect(resolveMethod('paypal', true)).toBe('paypal')
  })

  it('does not let a pay-later round trip forget PayPal', () => {
    const timing = resolveTiming('later', true)
    const method = resolveMethod('paypal', true)
    expect(timing).toBe('later')
    expect(method).toBe('paypal')

    expect(resolveTiming('now', true)).toBe('now')
    expect(resolveMethod('paypal', true)).toBe('paypal')
  })
})
