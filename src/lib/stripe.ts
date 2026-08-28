import { loadStripe } from '@stripe/stripe-js'
import type { Stripe as StripeJs } from '@stripe/stripe-js'

let stripePromise: Promise<StripeJs | null> | null = null

export function getStripePromise(): Promise<StripeJs | null> {
  if (!stripePromise) {
    const publishableKey = import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY
    if (!publishableKey) {
      console.error('[Stripe] VITE_STRIPE_PUBLISHABLE_KEY is not configured')
      stripePromise = Promise.resolve(null)
    } else {
      stripePromise = loadStripe(publishableKey)
    }
  }
  return stripePromise
}
