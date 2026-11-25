import StarRating from '../../components/StarRating'

export function displayLabel(value: string): string {
  return String(value || '')
    .replace(/[_-]+/g, ' ')
    .replace(/\b[a-z]/g, (letter) => letter.toUpperCase())
}

export function formatDate(value: string | null | undefined): string {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  return date.toLocaleDateString('en-GB', { month: 'short', year: 'numeric' })
}

const SOURCE_LABELS: Record<string, string> = {
  GOOGLE: 'Google',
  TRIPADVISOR: 'Tripadvisor',
  TRIP_ADVISOR: 'Tripadvisor',
  GETYOURGUIDE: 'GetYourGuide',
  GET_YOUR_GUIDE: 'GetYourGuide',
}

export function sourceLabel(source: string): string {
  return SOURCE_LABELS[source] ?? displayLabel(source.replace(/_/g, ' ').toLowerCase())
}

export function priceLabel(band: number | null): string {
  const labels: Record<number, string> = {
    1: 'Budget',
    2: 'Mid-range',
    3: 'Upscale',
    4: 'Fine dining',
  }
  return band ? labels[band] ?? `Price band ${band}` : ''
}

export function locationText(venue: {
  neighbourhood?: string | null
  city?: string | null
  region?: string | null
  country?: string | null
}): string {
  return [venue.neighbourhood, venue.city, venue.region, venue.country]
    .filter((part): part is string => Boolean(part))
    .join(', ')
}

export function Stars({ value, label }: { value: number; label?: string }) {
  return (
    <StarRating
      value={value}
      size={15}
      ariaLabel={label ?? `${value.toFixed(1)} out of 5 stars`}
    />
  )
}

export function formatHourValue(value: unknown): string {
  if (value == null) return ''
  if (Array.isArray(value)) return value.map(formatHourValue).filter(Boolean).join(' – ')
  if (typeof value === 'string' || typeof value === 'number') return String(value)
  if (typeof value === 'object') {
    const row = value as Record<string, unknown>
    const parts = [row.open, row.close, row.label, row.note]
      .map(formatHourValue)
      .filter(Boolean)
    if (parts.length) return parts.join(' – ')
  }
  return ''
}
