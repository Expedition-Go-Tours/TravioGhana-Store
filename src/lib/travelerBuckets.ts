/**
 * Traveler-category → checkout payload mapping.
 *
 * The Expedition checkout API accepts arbitrary traveler-count keys (adults,
 * children, infants, seniors, students, youth, …). The backend pricing engine
 * normalizes each key (seniors → senior, children → child, …) and matches it
 * against the supplier's pricing categories, so every supplier-defined
 * category can be priced at its own rate. These helpers build the exact
 * `travelers` shape to send: the three canonical buckets plus any extra
 * category under its own singular key.
 */

export type TravelerBucket = 'adults' | 'children' | 'infants'

/** Normalize a category label into a stable, lowercase key (e.g. "Adult" → "adult"). */
export function categoryKey(label: string): string {
  return String(label || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '')
}

const INFANT_KEYS = /infant|baby|toddler/
const CHILD_KEYS = /child|kid/

/** The canonical bucket a label maps to when it's one of the three standard ones. */
export function categoryBucket(label: string): TravelerBucket | null {
  const key = categoryKey(label)
  if (INFANT_KEYS.test(key)) return 'infants'
  if (CHILD_KEYS.test(key)) return 'children'
  if (key === 'adult') return 'adults'
  return null
}

/** Pluralized backend key for a category (adult → adults, senior → seniors). */
export function categoryPayloadKey(label: string): string {
  const bucket = categoryBucket(label)
  if (bucket) return bucket
  const key = categoryKey(label)
  // "senior" → "seniors", "youth" → "youths" (backend strips the trailing s).
  return key.endsWith('s') ? key : `${key}s`
}

/**
 * Sum per-category counts into the `travelers` payload shape the checkout API
 * requires. The three canonical buckets (adults/children/infants) are always
 * present; any extra category is sent under its own pluralized key so the
 * backend can price it at its own rate. Guarantees at least one traveler.
 */
export function sumCountsToBuckets(counts: Record<string, number>): Record<string, number> {
  const payload: Record<string, number> = { adults: 0, children: 0, infants: 0 }
  for (const [label, count] of Object.entries(counts)) {
    if (typeof count !== 'number' || count <= 0) continue
    const bucket = categoryBucket(label)
    if (bucket) {
      payload[bucket] += count
    } else {
      const key = categoryPayloadKey(label)
      payload[key] = (payload[key] || 0) + count
    }
  }
  return payload
}
