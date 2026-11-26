import { Star } from 'lucide-react'
import './StarRating.css'

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
