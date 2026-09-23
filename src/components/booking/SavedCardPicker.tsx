import { useState } from 'react'
import type { SavedCard } from '../../features/account/api'
import visaLogo from '@/assets/icons/visa.svg'
import mastercardLogo from '@/assets/icons/mastercard.svg'
import amexLogo from '@/assets/icons/card-brands/amex.svg'
import discoverLogo from '@/assets/icons/discover.png'

/** Sentinel selection meaning "enter a new card instead of using a saved one". */
export const NEW_CARD = '__new_card__'

const BRAND_LOGOS: Record<string, string> = {
  visa: visaLogo,
  mastercard: mastercardLogo,
  amex: amexLogo,
  discover: discoverLogo,
}

function BrandMark({ brand }: { brand: string }) {
  const [failed, setFailed] = useState(false)
  const src = BRAND_LOGOS[brand.toLowerCase()]

  if (!src || failed) {
    return (
      <span className="grid h-6 w-10 shrink-0 place-items-center rounded border border-slate-200 bg-white text-[9px] font-bold uppercase text-slate-500">
        {brand.slice(0, 4)}
      </span>
    )
  }

  return (
    <img
      src={src}
      alt={brand}
      className="h-6 w-10 shrink-0 rounded object-contain"
      onError={() => setFailed(true)}
    />
  )
}

function formatExp(m: number | null, y: number | null): string {
  if (!m || !y) return ''
  return `${String(m).padStart(2, '0')}/${String(y).slice(-2)}`
}

interface SavedCardPickerProps {
  cards: SavedCard[]
  /** Selected Stripe payment method id, or {@link NEW_CARD}. */
  value: string
  onChange: (id: string) => void
}

/**
 * Radio list of the customer's saved cards for the Reserve-now-pay-later step.
 * Purely presentational — the caller owns loading and the default selection.
 * Renders nothing when there are no cards, so the caller falls back to the
 * plain card field.
 */
export default function SavedCardPicker({ cards, value, onChange }: SavedCardPickerProps) {
  if (cards.length === 0) return null

  return (
    <div className="space-y-2">
      <p className="text-xs font-semibold text-slate-600">Use a saved card</p>

      {cards.map((card) => {
        const selected = value === card.id
        return (
          <label
            key={card.id}
            className={`flex cursor-pointer items-center gap-3 rounded-xl border p-3.5 transition-all ${
              selected
                ? 'border-emerald-300 bg-emerald-50/30 shadow-sm'
                : 'border-slate-200/60 bg-white hover:border-slate-300'
            }`}
          >
            <div
              className={`grid size-5 shrink-0 place-items-center rounded-full border-2 transition ${
                selected ? 'border-emerald-500' : 'border-slate-300'
              }`}
            >
              {selected && <span className="size-2.5 rounded-full bg-emerald-500" />}
            </div>
            <BrandMark brand={card.brand} />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-slate-900">•••• {card.last4}</p>
              <p className="text-xs text-slate-400">Expires {formatExp(card.expMonth, card.expYear)}</p>
            </div>
            {card.isDefault && (
              <span className="shrink-0 rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-500">
                Default
              </span>
            )}
            <input
              type="radio"
              name="savedCard"
              className="sr-only"
              checked={selected}
              onChange={() => onChange(card.id)}
            />
          </label>
        )
      })}

      <label
        className={`flex cursor-pointer items-center gap-3 rounded-xl border p-3.5 transition-all ${
          value === NEW_CARD
            ? 'border-emerald-300 bg-emerald-50/30 shadow-sm'
            : 'border-slate-200/60 bg-white hover:border-slate-300'
        }`}
      >
        <div
          className={`grid size-5 shrink-0 place-items-center rounded-full border-2 transition ${
            value === NEW_CARD ? 'border-emerald-500' : 'border-slate-300'
          }`}
        >
          {value === NEW_CARD && <span className="size-2.5 rounded-full bg-emerald-500" />}
        </div>
        <span className="text-sm font-semibold text-slate-900">Use a new card</span>
        <input
          type="radio"
          name="savedCard"
          className="sr-only"
          checked={value === NEW_CARD}
          onChange={() => onChange(NEW_CARD)}
        />
      </label>
    </div>
  )
}
