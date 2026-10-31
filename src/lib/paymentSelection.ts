/**
 * The two independent questions on the payment step.
 *
 * Checkout used to answer both with one tri-state (`now` / `later` / `paypal`),
 * which quietly made them mutually exclusive: selecting PayPal switched off the
 * "Pay now" highlight even though PayPal *is* paying now, and tapping "Pay now"
 * reset the method back to card, discarding the customer's choice.
 *
 * Keeping the questions separate also means each group can be its own radio
 * group, so the browser and screen readers no longer treat four radios across
 * two questions as one.
 */

export type PaymentTiming = 'now' | 'later'
export type PaymentMethod = 'card' | 'paypal'

/**
 * When the customer pays.
 *
 * A date inside the pay-later window silently falls back to paying now rather
 * than letting the server reject the booking with a 400.
 */
export function resolveTiming(
  requested: string | null | undefined,
  payLaterAvailable: boolean,
): PaymentTiming {
  return payLaterAvailable && requested === 'later' ? 'later' : 'now'
}

/**
 * How the customer pays, when paying now.
 *
 * PayPal drops back to card the moment the server stops offering it, so the
 * choice can never describe a method checkout would refuse.
 */
export function resolveMethod(
  requested: string | null | undefined,
  paypalAvailable: boolean,
): PaymentMethod {
  return paypalAvailable && requested === 'paypal' ? 'paypal' : 'card'
}
