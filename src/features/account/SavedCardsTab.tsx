import { useState, useEffect, useCallback } from 'react'
import { CreditCard, Plus, MoreVertical, ShieldCheck } from 'lucide-react'
import { toast } from 'sonner'
import {
  getPaymentMethods,
  setDefaultPaymentMethod,
  detachPaymentMethod,
  type SavedCard,
} from './api'
import AddCardModal, { type CardInfo } from './AddCardModal'
import visaLogo from '@/assets/icons/visa.svg'
import mastercardLogo from '@/assets/icons/mastercard.svg'
import amexLogo from '@/assets/icons/card-brands/amex.svg'
import discoverLogo from '@/assets/icons/discover.png'

const BRAND_LOGOS: Record<string, string> = {
  visa: visaLogo,
  mastercard: mastercardLogo,
  amex: amexLogo,
  discover: discoverLogo,
}

function BrandLogo({ brand }: { brand: string }) {
  const [failed, setFailed] = useState(false)
  const src = BRAND_LOGOS[brand.toLowerCase()]

  if (!src || failed) {
    return (
      <div className="card-brand-logo card-brand-text">
        {brand.slice(0, 4).toUpperCase()}
      </div>
    )
  }

  return (
    <img
      src={src}
      alt={brand}
      className="card-brand-logo"
      onError={() => setFailed(true)}
    />
  )
}

function formatExp(m: number | null, y: number | null): string {
  if (!m || !y) return '—'
  return `${String(m).padStart(2, '0')}/${y}`
}

function StripeNote() {
  return (
    <div className="account-secure">
      <ShieldCheck size={18} />
      <span>Payments securely processed by Stripe</span>
    </div>
  )
}

export default function SavedCardsTab() {
  const [cards, setCards] = useState<SavedCard[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showAdd, setShowAdd] = useState(false)
  const [menuOpen, setMenuOpen] = useState<string | null>(null)
  const [confirmRemove, setConfirmRemove] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      setLoading(true)
      setError(null)
      try {
        const data = await getPaymentMethods()
        if (!cancelled) setCards(data)
      } catch (err: unknown) {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Could not load cards')
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => { cancelled = true }
  }, [])

  const refresh = useCallback(async () => {
    // Don't flash loading skeleton if we already have cards (background refresh)
    if (cards.length === 0) {
      setLoading(true)
    }
    setError(null)
    try {
      const data = await getPaymentMethods()
      setCards(data)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Could not load cards')
    } finally {
      setLoading(false)
    }
  }, [cards.length])

  // Close menu on outside click
  useEffect(() => {
    if (!menuOpen) return
    const close = () => setMenuOpen(null)
    document.addEventListener('click', close)
    return () => document.removeEventListener('click', close)
  }, [menuOpen])

  const handleSetDefault = async (id: string) => {
    setMenuOpen(null)
    try {
      await setDefaultPaymentMethod(id)
      setCards((prev) =>
        prev.map((c) => ({ ...c, isDefault: c.id === id })),
      )
      toast.success('Default card updated')
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Could not update default')
    }
  }

  const handleRemove = async (id: string) => {
    setConfirmRemove(null)
    setMenuOpen(null)
    try {
      await detachPaymentMethod(id)
      setCards((prev) => prev.filter((c) => c.id !== id))
      toast.success('Card removed')
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Could not remove card')
    }
  }

  const handleAdded = (cardInfo?: CardInfo) => {
    setShowAdd(false)

    if (cardInfo) {
      // Optimistic: insert the new card immediately (mark as default if first card)
      setCards((prev) => {
        const isFirst = prev.length === 0
        const newCard: SavedCard = {
          id: cardInfo.id,
          brand: cardInfo.brand,
          last4: cardInfo.last4,
          expMonth: cardInfo.expMonth,
          expYear: cardInfo.expYear,
          expired: false,
          isDefault: isFirst,
        }
        return isFirst
          ? [newCard]
          : [...prev.map((c) => ({ ...c, isDefault: false })), newCard]
      })
    }

    // Refresh in background (no loading skeleton to avoid flicker)
    refresh()
  }

  // ── Loading skeleton ────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="account-panel">
        <div className="account-section__body">
          <div className="card-list">
            {[1, 2].map((i) => <div key={i} className="skeleton-row" />)}
          </div>
        </div>
      </div>
    )
  }

  // ── Error ───────────────────────────────────────────────────────────
  if (error) {
    return (
      <div className="account-panel">
        <div className="account-section__body">
          <div className="account-empty">
            <CreditCard size={40} />
            <p>{error}</p>
            <button className="account-btn account-btn--secondary" style={{ marginTop: 12 }} onClick={refresh}>
              Try again
            </button>
          </div>
        </div>
      </div>
    )
  }

  // ── Empty (template: illustration card + Add card + Stripe note) ────
  if (cards.length === 0) {
    return (
      <>
        <div className="account-panel account-panel--saved">
          <div className="account-empty-card">
            <div>
              <div className="account-empty-icon">
                <div className="account-card-illus" />
              </div>
              <h2 className="account-empty-title">No saved cards yet</h2>
              <p className="account-empty-copy">Add a card to speed up checkout.</p>
              <button className="account-btn--add-card" onClick={() => setShowAdd(true)}>
                <Plus size={22} /> Add card
              </button>
            </div>
          </div>
          <StripeNote />
        </div>

        {showAdd && <AddCardModal onClose={() => setShowAdd(false)} onAdded={handleAdded} />}
      </>
    )
  }

  // ── Card list ───────────────────────────────────────────────────────
  return (
    <>
      <div className="account-panel account-panel--saved">
        <div className="account-section__header">
          <CreditCard size={26} />
          <div>
            <h3>Saved Cards</h3>
            <p className="account-section__copy">
              Manage the cards you use for faster checkout.
            </p>
          </div>
        </div>

        <div className="account-section__body">
          <div className="card-list">
            {cards.map((card) => (
              <div key={card.id} className="card-row">
                {/* Brand logo */}
                <BrandLogo brand={card.brand} />

                {/* Info */}
                <div className="card-info">
                  <div className="card-details">
                    <span className="card-last4">•••• {card.last4}</span>
                    <span className="card-sep" aria-hidden="true">·</span>
                    <span className="card-exp">Expires {formatExp(card.expMonth, card.expYear)}</span>
                  </div>
                  {(card.isDefault || card.expired) && (
                    <div className="card-badges">
                      {card.isDefault && <span className="card-badge card-badge--default">Default</span>}
                      {card.expired && <span className="card-badge card-badge--expired">Expired</span>}
                    </div>
                  )}
                </div>

                {/* Menu */}
                <div className="card-menu-wrap">
                  <button
                    className="card-menu-btn"
                    onClick={(e) => {
                      e.stopPropagation()
                      setMenuOpen(menuOpen === card.id ? null : card.id)
                    }}
                    aria-label="Card options"
                  >
                    <MoreVertical size={16} />
                  </button>

                  {menuOpen === card.id && (
                    <div className="card-menu">
                      {!card.isDefault && (
                        <button className="card-menu-item" onClick={() => handleSetDefault(card.id)}>
                          Set as default
                        </button>
                      )}
                      <button
                        className="card-menu-item card-menu-item--danger"
                        onClick={() => {
                          setMenuOpen(null)
                          setConfirmRemove(card.id)
                        }}
                      >
                        Remove card
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="account-actions">
          <button className="account-btn account-btn--primary" onClick={() => setShowAdd(true)}>
            <Plus size={16} /> Add card
          </button>
        </div>

        <StripeNote />
      </div>

      {/* ── Remove confirmation ────────────────────────────────────────── */}
      {confirmRemove && (
        <div className="account-modal-overlay" onClick={() => setConfirmRemove(null)}>
          <div className="account-modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 380 }}>
            <div className="account-modal__header">
              <h3>Remove card?</h3>
              <button className="account-modal__close" onClick={() => setConfirmRemove(null)} aria-label="Close">✕</button>
            </div>
            <div className="account-modal__body">
              <p style={{ fontSize: 14, color: 'var(--acc-muted, #667085)', margin: 0 }}>
                This card will be removed from your saved payment methods.
              </p>
            </div>
            <div className="account-modal__footer">
              <button className="account-btn account-btn--secondary" onClick={() => setConfirmRemove(null)}>
                Cancel
              </button>
              <button
                className="account-btn"
                style={{ background: '#dc2626', color: '#fff' }}
                onClick={() => handleRemove(confirmRemove)}
              >
                Remove
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Add card modal ────────────────────────────────────────────── */}
      {showAdd && <AddCardModal onClose={() => setShowAdd(false)} onAdded={handleAdded} />}
    </>
  )
}
