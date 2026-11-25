import { Star } from 'lucide-react'
import './StarRating.css'

export const RATING_LABELS = ['Terrible', 'Poor', 'Average', 'Very good', 'Excellent'] as const

interface StarRatingProps {
  value: number
  size?: number
  gap?: number
  filledColor?: string
  emptyColor?: string
  strokeWidth?: number
  className?: string
  starClassName?: string
  ariaLabel?: string
}

interface StarRatingInputProps {
  value: number
  onChange: (value: number) => void
  label: string
  name?: string
  compact?: boolean
  showLabels?: boolean
}

/** Interactive 1–5 stars. Each star is a radio, keyboard accessible. */
export function StarRatingInput({
  value,
  onChange,
  label,
  name = 'rating',
  compact = false,
  showLabels = !compact,
}: StarRatingInputProps) {
  return (
    <fieldset className={`star-input${compact ? ' star-input--compact' : ''}`}>
      <legend>{label}</legend>
      <div className="star-input__row" role="radiogroup" aria-label={label}>
        {[1, 2, 3, 4, 5].map((rating) => {
          const selected = value === rating
          const filled = rating <= value
          return (
            <label key={rating} className={selected ? 'is-selected' : ''}>
              <input
                type="radio"
                name={name}
                value={rating}
                checked={selected}
                onChange={() => onChange(rating)}
                aria-label={`${rating} of 5 stars${compact ? '' : ` — ${RATING_LABELS[rating - 1]}`}`}
              />
              <span className="star-input__icon" aria-hidden="true">
                <Star
                  size={compact ? 20 : 34}
                  strokeWidth={1.8}
                  fill={filled ? 'currentColor' : 'none'}
                />
              </span>
              {showLabels && <small>{RATING_LABELS[rating - 1]}</small>}
            </label>
          )
        })}
      </div>
    </fieldset>
  )
}

export default function StarRating({
  value,
  size = 16,
  gap = 2,
  filledColor = '#179237',
  emptyColor = '#e5e7eb',
  strokeWidth = 1.5,
  className,
  starClassName,
  ariaLabel,
}: StarRatingProps) {
  const label = ariaLabel ?? `${value} out of 5 stars`

  const fillFor = (i: number) => {
    if (value >= i + 1) return 1
    if (value >= i + 0.5) return 0.5
    return 0
  }

  return (
    <span
      className={`star-rating${className ? ` ${className}` : ''}`}
      style={{ gap }}
      role="img"
      aria-label={label}
    >
      {[0, 1, 2, 3, 4].map((i) => {
        const fill = fillFor(i)
        return (
          <span
            key={i}
            className={`star-rating__cell${starClassName ? ` ${starClassName}` : ''}`}
            style={{ width: size, height: size }}
          >
            <Star
              size={size}
              strokeWidth={strokeWidth}
              fill="none"
              color={emptyColor}
              className="star-rating__icon"
            />
            {fill > 0 && (
              <span
                className="star-rating__fill"
                style={{ width: `${fill * 100}%` }}
                aria-hidden="true"
              >
                <Star
                  size={size}
                  strokeWidth={strokeWidth}
                  fill={filledColor}
                  color={filledColor}
                  className="star-rating__icon"
                />
              </span>
            )}
          </span>
        )
      })}
    </span>
  )
}
