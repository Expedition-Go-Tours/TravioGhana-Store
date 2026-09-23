import { useEffect, useRef, useState } from 'react'
import { X } from 'lucide-react'
import type { Stripe, StripeElements, StripePaymentElement } from '@stripe/stripe-js'
import { getStripePromise } from '../../lib/stripe'
import { createSetupIntent } from './api'

const UNAVAILABLE = 'Secure card collection is unavailable — please try again shortly.'

export interface CardInfo {
  id: string
  brand: string
  last4: string
  expMonth: number
  expYear: number
}

interface AddCardModalProps {
  onClose: () => void
  onAdded: (card?: CardInfo) => void
}

export default function AddCardModal({ onClose, onAdded }: AddCardModalProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const stripeRef = useRef<Stripe | null>(null)
  const elementsRef = useRef<StripeElements | null>(null)
  const elRef = useRef<StripePaymentElement | null>(null)

  const [ready, setReady] = useState(false)
  const [complete, setComplete] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [fatal, setFatal] = useState<string | null>(null)
  const [clientSecret, setClientSecret] = useState<string | null>(null)

  // Fetch the SetupIntent client secret
  useEffect(() => {
    let cancelled = false
    createSetupIntent()
      .then((secret) => { if (!cancelled) setClientSecret(secret) })
      .catch(() => { if (!cancelled) setFatal(UNAVAILABLE) })
    return () => { cancelled = true }
  }, [])

  // Mount Payment Element once we have the secret
  useEffect(() => {
    if (!clientSecret) return
    let cancelled = false
    const container = containerRef.current
    if (!container) return

    getStripePromise()
      .then(async (stripe) => {
        if (cancelled || !stripe) {
          if (!cancelled) setFatal(UNAVAILABLE)
          return
        }
        stripeRef.current = stripe

        const origin = typeof window !== 'undefined' ? window.location.origin : ''
        const elements = stripe.elements({
          clientSecret,
          appearance: {
            theme: 'stripe',
            labels: 'floating',
            variables: {
              colorPrimary: '#16a34a',
              colorText: '#101828',
              colorTextSecondary: '#667085',
              colorDanger: '#dc2626',
              colorBackground: '#ffffff',
              fontFamily: '"DM Sans", "Manrope", sans-serif',
              fontSizeBase: '16px',
              borderRadius: '10px',
              spacingUnit: '3px',
            },
            rules: {
              '.Input': { backgroundColor: '#ffffff' },
              '.Tab, .Input, .Block': { boxShadow: 'none' },
            },
          },
          fonts: [{ cssSrc: `${origin}/fonts/checkout-fonts.css` }],
        })
        if (cancelled) return
        elementsRef.current = elements

        const pe = elements.create('payment')
        if (cancelled) {
          pe.destroy()
          return
        }
        elRef.current = pe
        pe.mount(container)

        pe.on('ready', () => { if (!cancelled) setReady(true) })
        pe.on('change', (e) => { if (!cancelled) setComplete(Boolean(e.complete)) })
      })
      .catch(() => {
        if (!cancelled) setFatal(UNAVAILABLE)
      })

    return () => {
      cancelled = true
      elRef.current?.unmount()
      elRef.current?.destroy()
      elRef.current = null
      elementsRef.current = null
      stripeRef.current = null
    }
  }, [clientSecret])

  // Confirm setup (save the card)
  const handleConfirm = async () => {
    if (!stripeRef.current || !elementsRef.current || submitting) return
    setSubmitting(true)

    try {
      const { error, setupIntent } = await stripeRef.current.confirmSetup({
        elements: elementsRef.current,
        confirmParams: {
          return_url: window.location.href,
          // Required for the card to be offered again in the Payment Element
          // ("Saved payment methods"). Without this Stripe stores the card
          // with allow_redisplay: 'unspecified' and hides it at checkout.
          payment_method_data: { allow_redisplay: 'always' },
        },
        redirect: 'if_required',
      })

      if (error) {
        setFatal(error.message || 'Could not save your card. Please try again.')
        setSubmitting(false)
        return
      }

      // Extract card details for optimistic UI update
      const pm = setupIntent?.payment_method
      let cardInfo: CardInfo | undefined
      if (pm && typeof pm === 'object' && 'card' in pm) {
        const card = (pm as any).card
        if (card) {
          cardInfo = {
            id: (pm as any).id || String(pm),
            brand: card.brand || 'card',
            last4: card.last4 || '****',
            expMonth: card.exp_month ?? 0,
            expYear: card.exp_year ?? 0,
          }
        }
      }

      // Success — no redirect needed (redirect: 'if_required')
      onAdded(cardInfo)
    } catch {
      setFatal('Something went wrong. Please try again.')
      setSubmitting(false)
    }
  }

  return (
    <div className="account-modal-overlay" onClick={onClose}>
      <div className="account-modal" onClick={(e) => e.stopPropagation()}>
        <div className="account-modal__header">
          <h3>Add a card</h3>
          <button className="account-modal__close" onClick={onClose}>
            <X size={18} />
          </button>
        </div>

        <div className="account-modal__body">
          {!clientSecret && !fatal && (
            <div style={{ display: 'flex', justifyContent: 'center', padding: 32 }}>
              <div className="skeleton-row" style={{ width: '100%' }} />
            </div>
          )}

          <div
            ref={containerRef}
            style={{
              minHeight: ready ? 0 : 120,
              opacity: ready ? 1 : 0,
              transition: 'opacity 0.2s',
            }}
          />

          {fatal && (
            <p style={{ marginTop: 12, fontSize: 13, color: '#dc2626', fontWeight: 500 }} role="alert">
              {fatal}
            </p>
          )}
        </div>

        <div className="account-modal__footer">
          <button
            className="account-btn"
            style={{ background: 'var(--bv-surface-2, #f2f4f7)', color: 'var(--bv-ink)' }}
            onClick={onClose}
          >
            Cancel
          </button>
          <button
            className="account-btn account-btn--primary"
            disabled={!ready || !complete || submitting}
            onClick={handleConfirm}
          >
            {submitting ? 'Saving…' : 'Save card'}
          </button>
        </div>
      </div>
    </div>
  )
}
