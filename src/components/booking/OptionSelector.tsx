import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import type { TourOption } from '../../lib/tourTypes'
import './OptionSelector.css'

export interface OptionSelectorProps {
  options: TourOption[]
  value?: string | null
  onChange: (optionId: string) => void
  disabledIds?: Set<string>
  loading?: boolean
}

function fmtMoney(amount: number | null | undefined, currency = 'USD'): string {
  if (amount == null) return ''
  try {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: currency || 'USD', maximumFractionDigits: 0 }).format(amount)
  } catch {
    return `$${Math.round(amount)}`
  }
}

/** GYG-style option rows: pick a sellable option before choosing date/time. */
export default function OptionSelector({ options, value, onChange, disabledIds, loading }: OptionSelectorProps) {
  const { t } = useTranslation()

  const visible = useMemo(
    () => options.filter((o) => !o.isPrivate),
    [options]
  )

  if (loading && visible.length === 0) {
    return (
      <div className="osc" role="radiogroup" aria-label={t('booking.selectOption', 'Choose your option')}>
        <div className="osc-row osc-skeleton" aria-hidden="true" />
        <div className="osc-row osc-skeleton" aria-hidden="true" />
      </div>
    )
  }

  if (visible.length === 0) return null

  const selected = value && visible.some((o) => o.id === value) ? value : null

  return (
    <div className="osc" role="radiogroup" aria-label={t('booking.selectOption', 'Choose your option')}>
      {visible.map((option, idx) => {
        const isDisabled = !!disabledIds?.has(option.id)
        const isSelected = selected === option.id
        const price = fmtMoney(option.fromPrice, option.currency)
        return (
          <button
            key={option.id}
            type="button"
            role="radio"
            aria-checked={isSelected}
            disabled={isDisabled}
            onClick={() => onChange(option.id)}
            onKeyDown={(e) => {
              if (e.key === 'ArrowDown' || e.key === 'ArrowRight') {
                e.preventDefault()
                const next = visible[(idx + 1) % visible.length]
                if (next && !disabledIds?.has(next.id)) onChange(next.id)
              } else if (e.key === 'ArrowUp' || e.key === 'ArrowLeft') {
                e.preventDefault()
                const prev = visible[(idx - 1 + visible.length) % visible.length]
                if (prev && !disabledIds?.has(prev.id)) onChange(prev.id)
              }
            }}
            className={`osc-row${isSelected ? ' osc-selected' : ''}${isDisabled ? ' osc-disabled' : ''}`}
          >
            <span className="osc-radio" aria-hidden="true" />
            <span className="osc-main">
              <span className="osc-title">
                {option.title}
                {option.isPrivate ? <em className="osc-tag">{t('booking.optionPrivate', 'Private')}</em> : null}
              </span>
              {option.description ? <span className="osc-desc">{option.description}</span> : null}
              {option.validity != null ? (
                <span className="osc-meta">
                  {t('booking.optionValidDays', 'Valid {{value}} {{unit}} from booking', {
                    value: option.validity,
                    unit: option.validityUnit || 'days',
                  })}
                </span>
              ) : null}
            </span>
            {price ? (
              <span className="osc-price">
                <small>{t('booking.optionFrom', 'from')}</small>
                <strong>{price}</strong>
              </span>
            ) : null}
          </button>
        )
      })}
    </div>
  )
}
