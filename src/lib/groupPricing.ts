/**
 * Group pricing helpers shared by the booking widget and its tests.
 *
 * When a supplier prices a tour "per group" they define flat headcount bands
 * (e.g. "Group of 1-2", "Group of 3-5"), each with one flat price for the
 * whole group. This mirrors Viator/GetYourGuide group pricing: the widget
 * snaps the traveler count into the valid band range so a price always
 * resolves, and shows the matching band.
 */

export interface GroupSizeBandLike {
  from: number
  to: number
  price: number
}

const FALLBACK_MAX = 50

/** The valid headcount range covered by the supplier's group-size bands. */
export function groupPricingRange(bands: GroupSizeBandLike[]): { min: number; max: number } {
  if (!bands || bands.length === 0) return { min: 1, max: FALLBACK_MAX }
  const min = Math.min(...bands.map((b) => b.from))
  const maxTo = Math.max(...bands.map((b) => (Number.isFinite(b.to) ? b.to : FALLBACK_MAX)))
  return { min, max: Math.max(min, maxTo) }
}

/** Clamps a headcount into the valid band range (the checkout rejects outliers). */
export function clampGroupHeadcount(count: number, bands: GroupSizeBandLike[]): number {
  const { min, max } = groupPricingRange(bands)
  return Math.min(Math.max(count, min), max)
}

/** The flat-rate band matching the current headcount, if any. */
export function matchGroupBand(count: number, bands: GroupSizeBandLike[]): GroupSizeBandLike | undefined {
  if (!bands) return undefined
  return bands.find((b) => count >= b.from && count <= b.to)
}

/** Human label for a band, e.g. "1-2", "4+", or "3" for a single-headcount band. */
export function groupBandLabel(band: GroupSizeBandLike | undefined): string {
  if (!band) return ''
  if (band.from === band.to) return `${band.from}`
  return Number.isFinite(band.to) ? `${band.from}-${band.to}` : `${band.from}+`
}

/** Cheapest band price — used for the "from $X per group" headline. */
export function lowestGroupBandPrice(bands: GroupSizeBandLike[]): number | undefined {
  if (!bands || bands.length === 0) return undefined
  return Math.min(...bands.map((b) => b.price))
}
