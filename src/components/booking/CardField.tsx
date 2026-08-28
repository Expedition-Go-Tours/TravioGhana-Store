import { useEffect, useRef, useState } from 'react'
import type { StripeCardElement, StripeCardElementOptions } from '@stripe/stripe-js'
import { getStripePromise } from '../../lib/stripe'

export interface CardElementHandle {
  /** Creates a Stripe PaymentMethod for the card entered in the field. */
  createPaymentMethod: () => Promise<{ paymentMethod: { id: string } | null; error?: { message?: string } }>
}

const CARD_STYLE: StripeCardElementOptions['style'] = {
  base: {
    fontSize: '14px',
    color: '#111827',
    fontFamily: 'ui-sans, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
    '::placeholder': { color: '#9CA3AF' },
  },
}

const CARD_UNAVAILABLE = 'Card entry is unavailable right now — payment settings are incomplete.'

export default function CardField({
  onReady,
}: {
  onReady: (handle: CardElementHandle) => void
}) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [error, setError] = useState<string | null>(null)
  const cardRef = useRef<StripeCardElement | null>(null)
  const stripePromiseRef = useRef(getStripePromise())

  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    let cancelled = false
    stripePromiseRef.current
      .then((stripe) => {
        if (cancelled) return
        // No publishable key configured (or loadStripe returned null) — surface
        // it instead of silently leaving an empty box + a confusing Pay Now toast.
        if (!stripe) {
          setError(CARD_UNAVAILABLE)
          return
        }
        setError(null)
        const elements = stripe.elements()
        if (cancelled) return
        if (!cardRef.current) {
          const card = elements.create('card', {
            style: CARD_STYLE,
            hidePostalCode: true,
            hideIcon: false,
          })
          if (cancelled) {
            card.destroy()
            return
          }
          cardRef.current = card
          card.mount(container)
        }
        const card = cardRef.current
        onReady({
          createPaymentMethod: async () => {
            const result = await stripe.createPaymentMethod({ type: 'card', card })
            return {
              paymentMethod: result.paymentMethod ? { id: result.paymentMethod.id } : null,
              error: result.error,
            }
          },
        })
      })
      .catch(() => {
        if (cancelled) return
        setError('Card entry is unavailable right now — please try again in a moment.')
      })

    return () => {
      cancelled = true
      cardRef.current?.unmount()
      cardRef.current = null
    }
  }, [onReady])

  return (
    <div>
      <div
        ref={containerRef}
        className="rounded-xl border border-slate-200 bg-slate-50/40 p-3 focus-within:border-emerald-400 focus-within:ring-2 focus-within:ring-emerald-100"
      />
      {error && <p className="mt-2 text-xs font-medium text-rose-600">{error}</p>}
    </div>
  )
}
