/**
 * Age-category tier pricing helpers shared by the booking widget and its
 * tests. Mirrors Travio Ghana-Backend/utils/tourHelpers.js#calculateTourPrice
 * (the "dependsOnAge" branch): when a pricing category defines tiers, the
 * per-person price for that category depends on the TOTAL number of
 * travelers across the whole booking (not just how many of that category
 * are booked) — this is the same GetYourGuide-style tiered pricing model
 * used on the supplier side (Travio Ghana-Supplier's Step 14 pricing step).
 */

export interface PricingTierLike {
  from: number
  to: number
  pricePerPerson: number
}

export interface TieredGroupLike {
  price: number
  tiers?: PricingTierLike[]
}

/** The tier whose [from, to] range covers the current total traveler count, if any. */
export function findActiveTier(
  group: TieredGroupLike | undefined,
  totalTravelers: number
): PricingTierLike | undefined {
  if (!group?.tiers || group.tiers.length === 0) return undefined
  return group.tiers.find((t) => totalTravelers >= t.from && totalTravelers <= t.to)
}

/**
 * Resolves the per-person price to charge for a traveler category given the
 * current total headcount: the matching tier's price when tiers are defined
 * and one matches, the category's flat price otherwise, and the fallback
 * when there's no category at all (e.g. tour.price for an untyped Adult rate).
 */
export function resolveTierPrice(
  group: TieredGroupLike | undefined,
  totalTravelers: number,
  fallback: number
): number {
  if (!group) return fallback
  const tier = findActiveTier(group, totalTravelers)
  if (tier) return tier.pricePerPerson
  return group.price
}

/** Whether this category has tiered (headcount-dependent) pricing at all. */
export function hasTieredPricing(group: TieredGroupLike | undefined): boolean {
  return !!group?.tiers && group.tiers.length > 0
}

/** Human label for a tier's headcount range, e.g. "3-5", "6+", or "2" for a single-headcount tier. */
export function tierRangeLabel(tier: PricingTierLike | undefined): string {
  if (!tier) return ''
  if (tier.from === tier.to) return `${tier.from}`
  return Number.isFinite(tier.to) ? `${tier.from}-${tier.to}` : `${tier.from}+`
}
