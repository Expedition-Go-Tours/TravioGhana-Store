/**
 * Client-side passenger-mix validation — mirrors Travio Ghana-Backend/utils/
 * passengerMix.js so the booking widget can pre-empt invalid parties (Viator
 * best practice: invalid mixes are unselectable, not error messages).
 *
 * Rules enforced (from the supplier's pricing categories + capacity settings):
 *  - total travelers within [minParticipants, maxParticipants]
 *  - categories marked `notAllowed` are never bookable
 *  - any category marked `needsAdult` requires at least one adult/senior-like
 *    traveler in the party
 */

import type { TravelerPricing } from './tourTypes'
import { categoryKey } from './travelerBuckets'

const IRREGULAR_PLURALS: Record<string, string> = { children: 'child', infants: 'infant' }

function normalizeKey(key: string): string {
  const lower = String(key || '').toLowerCase()
  return IRREGULAR_PLURALS[lower] || lower.replace(/s$/, '')
}

function isGuardian(label: string): boolean {
  const key = categoryKey(label)
  return key === 'adult' || key === 'senior'
}

export interface PassengerMixIssue {
  type: 'min' | 'max' | 'notAllowed' | 'needsAdult'
  message: string
}

export interface BookableBounds {
  min: number
  max: number | null
}

export interface BookableBoundsInput {
  isPerGroup: boolean
  /** Smallest headcount the supplier's group-size bands cover (per-group only). */
  groupBandMin: number
  /** Largest headcount the supplier's group-size bands cover (per-group only). */
  groupBandMax: number
  /** Supplier's party minimum (travelerDetails.minParticipants). */
  minParticipants: number | null
  /** Supplier's party maximum (travelerDetails.maxParticipants). */
  maxParticipants: number | null
}

/**
 * The EFFECTIVE bookable headcount range a traveler picker must enforce,
 * combining the supplier's capacity bounds (minParticipants/maxParticipants)
 * with the pricing model's own constraints:
 *  - per-person: the supplier's minimum (defaulting to 1 traveler), and the
 *    supplier's maximum when set
 *  - per-group: the wider of the group-size bands and the supplier's bounds —
 *    the stepper must never allow a headcount the supplier's bands or capacity
 *    settings would reject
 * The range is sanity-clamped so a mis-configured supplier minimum can never
 * surface an empty/unreachable range.
 */
export function resolveBookableBounds({
  isPerGroup,
  groupBandMin,
  groupBandMax,
  minParticipants,
  maxParticipants,
}: BookableBoundsInput): BookableBounds {
  let min: number
  let max: number | null
  if (isPerGroup) {
    min = Math.max(groupBandMin, minParticipants ?? groupBandMin)
    max = maxParticipants != null ? Math.min(groupBandMax, maxParticipants) : groupBandMax
  } else {
    min = minParticipants ?? 1
    max = maxParticipants
  }
  if (max != null && min > max) min = max
  return { min, max }
}

/**
 * Validate a per-category counts map (keyed by categoryKey) against the tour's
 * passenger-mix rules. Returns an array of issues; empty = valid.
 */
export function validatePassengerMix(
  categories: TravelerPricing[],
  counts: Record<string, number>,
  bounds: { min: number | null; max: number | null }
): PassengerMixIssue[] {
  const issues: PassengerMixIssue[] = []

  const total = Object.values(counts).reduce(
    (sum, c) => sum + (typeof c === 'number' && c > 0 ? c : 0),
    0
  )

  if (bounds.min != null && total < bounds.min) {
    issues.push({
      type: 'min',
      message: `At least ${bounds.min} traveler${bounds.min === 1 ? '' : 's'} required`,
    })
  }
  if (bounds.max != null && total > bounds.max) {
    issues.push({
      type: 'max',
      message: `Maximum of ${bounds.max} travelers allowed`,
    })
  }

  for (const [key, count] of Object.entries(counts)) {
    if (typeof count !== 'number' || count <= 0) continue
    const cat = categories.find((c) => categoryKey(c.label) === key)
    if (cat?.notAllowed) {
      issues.push({ type: 'notAllowed', message: `${cat.label} is not permitted on this tour` })
    }
  }

  const needsGuardian = categories.some((c) => c.needsAdult === true)
  const hasGuardian = Object.entries(counts).some(([key, count]) => {
    if (typeof count !== 'number' || count <= 0) return false
    const cat = categories.find((c) => categoryKey(c.label) === key)
    return cat ? isGuardian(cat.label) : normalizeKey(key) === 'adult'
  })
  if (needsGuardian && !hasGuardian) {
    issues.push({ type: 'needsAdult', message: 'At least one adult or senior is required' })
  }

  return issues
}
