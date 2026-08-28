/**
 * "From $X" price helpers shared by tour cards and the booking widget.
 *
 * The card and the widget must quote the SAME price: the lowest price of the
 * ADULT tier (per-person base price plus any headcount tier prices) — never a
 * cheaper child/senior rate. Mirrors Travio Ghana-Backend's
 * utils/tourHelpers.js `cheapestRetailPrice`, which the backend listings
 * delegate to as well, so every surface agrees on the same number.
 */
import type { TravelerPricing } from './tourTypes'

function toFinite(v: unknown): number | null {
  const n = typeof v === 'number' ? v : typeof v === 'string' ? Number(v) : NaN
  return Number.isFinite(n) ? n : null
}

function isAdultLabel(label: unknown): boolean {
  const l = String(label ?? '').trim().toLowerCase()
  return l === 'adult' || l === 'adults'
}

/** Cheapest price a card can quote as "From $X" from a raw schedulesAndPricing
    blob: the lowest ADULT-tier per-person price (base + tier prices). Falls
    back to the per-group minimum band, the uniform price, or legacy derived
    schedule prices when no adult category exists. Returns null when nothing
    is priceable. */
export function lowestAdultRetailPrice(sp: unknown): number | null {
  if (!sp) return null
  let data: any
  try {
    data = typeof sp === 'string' ? JSON.parse(sp) : sp
  } catch {
    return null
  }
  if (!data || typeof data !== 'object') return null

  const td = data.travelerDetails || {}
  const pricingModel = td.pricingModel || 'perPerson'
  const pricingApproach = td.pricingApproach || 'dependsOnAge'

  // perGroup: a flat price per headcount band — quote the cheapest band.
  if (pricingModel === 'perGroup') {
    const bands = Array.isArray(td.groupSizes) ? td.groupSizes : []
    const prices = bands
      .map((b: any) => toFinite(b?.price))
      .filter((p: number | null): p is number => p != null)
    return prices.length > 0 ? Math.min(...prices) : null
  }

  // sameForEveryone: one flat per-person price for every traveler type.
  if (pricingApproach === 'sameForEveryone') {
    return toFinite(td.uniformPrice)
  }

  // dependsOnAge: adult-only, min over base + tier prices.
  const cats = (Array.isArray(td.pricingCategories) && td.pricingCategories.length > 0)
    ? td.pricingCategories
    : (Array.isArray(td.ageGroups) ? td.ageGroups : [])
  const adultish = cats.filter((c: any) => isAdultLabel(c?.name ?? c?.label))
  const base = adultish.length > 0 ? adultish : cats

  const candidates: number[] = []
  for (const cat of base) {
    const basePrice = toFinite(cat?.price)
    if (basePrice != null) candidates.push(basePrice)
    if (Array.isArray(cat?.tiers)) {
      for (const tier of cat.tiers) {
        const tierPrice = toFinite(tier?.pricePerPerson)
        if (tierPrice != null) candidates.push(tierPrice)
      }
    }
  }
  if (candidates.length > 0) return Math.min(...candidates)

  // Legacy blobs that predate travelerDetails: cheapest derived schedule price.
  const schedules = data.pricingSchedules?.schedules
  if (Array.isArray(schedules)) {
    const legacy: number[] = []
    for (const s of schedules) {
      if (Array.isArray(s?.prices)) {
        for (const p of s.prices) {
          const n = toFinite(p?.retailPrice)
          if (n != null) legacy.push(n)
        }
      }
    }
    if (legacy.length > 0) return Math.min(...legacy)
  }

  return null
}

/** Lowest ADULT-tier per-person price from the mapped travelerPricing list
    (the booking widget's mirror of pricingCategories) — the same semantics as
    lowestAdultRetailPrice, so the widget quotes exactly what the card shows.
    Returns null when the list is empty (e.g. per-group tours, which use the
    group-size bands instead). */
export function lowestAdultFromTravelerPricing(travelerPricing: TravelerPricing[] | undefined): number | null {
  if (!Array.isArray(travelerPricing) || travelerPricing.length === 0) return null
  const adultish = travelerPricing.filter((g) => isAdultLabel(g.label))
  const base = adultish.length > 0 ? adultish : travelerPricing
  const candidates: number[] = []
  for (const g of base) {
    const basePrice = toFinite(g.price)
    if (basePrice != null) candidates.push(basePrice)
    if (Array.isArray(g.tiers)) {
      for (const tier of g.tiers) {
        const tierPrice = toFinite(tier.pricePerPerson)
        if (tierPrice != null) candidates.push(tierPrice)
      }
    }
  }
  return candidates.length > 0 ? Math.min(...candidates) : null
}
