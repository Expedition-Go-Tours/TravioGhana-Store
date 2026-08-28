/**
 * Shared traveler-selection logic used by the tour-detail booking widget and
 * the booking page's change-booking modal, so both behave exactly alike.
 *
 * Encapsulates everything the traveler picker needs to mirror the supplier's
 * Step-14 pricing: per-person vs per-group models, age categories, tiered
 * (headcount-dependent) pricing, passenger-mix rules and the client-side
 * subtotal that mirrors the checkout calculation.
 */
import { useState, useCallback, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { useCurrency } from '../contexts/CurrencyContext'
import type { TravelerPricing } from '../lib/tourTypes'
import {
  clampGroupHeadcount,
  groupBandLabel,
  groupPricingRange,
} from '../lib/groupPricing'
import {
  findActiveTier,
  hasTieredPricing,
  resolveTierPrice,
  tierRangeLabel,
} from '../lib/tierPricing'
import { categoryKey, sumCountsToBuckets } from '../lib/travelerBuckets'
import { resolveBookableBounds, validatePassengerMix } from '../lib/passengerMix'

export interface TravelerSelectionTour {
  pricingModel?: 'perPerson' | 'perGroup'
  travelerPricing?: TravelerPricing[]
  groupSizePricing?: { from: number; to: number; price: number }[]
  minParticipants?: number | null
  maxParticipants?: number | null
  price?: number
}

export interface TravelerSelectionOptions {
  /** Per-category seed counts keyed by categoryKey (e.g. { adult: 2 }). */
  initialCounts?: Record<string, number>
  /** Seed headcount for per-group pricing. */
  initialHeadcount?: number
}

/** Seed the per-category counts: the first adult-like category defaults to at
    least 2 (or the supplier's minimum party size, whichever is higher), all
    others 0. */
export function defaultCountsFor(categories: TravelerPricing[], minTravelers = 2): Record<string, number> {
  const counts: Record<string, number> = {}
  const primary = categories.findIndex((g) => /adult/i.test(g.label))
  const adultIdx = primary >= 0 ? primary : 0
  const seed = Math.max(2, minTravelers)
  categories.forEach((g, i) => {
    counts[categoryKey(g.label)] = i === adultIdx ? seed : 0
  })
  return counts
}

export interface TravelerOption {
  label: string
  age: string
  price: string
  lineTotal: number
  count: number
  key: string
}

export function useTravelerSelection(tour: TravelerSelectionTour, options?: TravelerSelectionOptions) {
  const { t } = useTranslation()
  const { currency } = useCurrency()

  // Pricing model straight from the supplier's Step 14 builder choices:
  // 'perGroup' means a flat price per headcount band (no per-traveler-type
  // pricing at all); 'perPerson' covers both sameForEveryone (uniform price
  // for every traveler type) and dependsOnAge (per-category, optionally tiered).
  const isPerGroup = tour.pricingModel === 'perGroup'

  const groupSizeBands = useMemo(() => tour.groupSizePricing || [], [tour.groupSizePricing])

  const travelerGroups = useMemo(() => {
    const pricing = tour.travelerPricing || []
    if (pricing.length > 0) return pricing
    return [{ label: 'Adult', price: tour.price || 0, minAge: null, maxAge: null }]
  }, [tour.travelerPricing, tour.price])

  // For per-group pricing the supplier defines flat headcount bands, and the
  // checkout fails when the selected headcount falls outside every band. The
  // +/- steppers stop at these edges.
  const { min: groupMinHeadcount, max: groupMaxHeadcount } = useMemo(
    () => groupPricingRange(groupSizeBands),
    [groupSizeBands],
  )

  // The EFFECTIVE bookable headcount range the picker must enforce: the
  // supplier's capacity bounds (minParticipants/maxParticipants) combined with
  // the pricing model's own constraints — the steppers can never select a
  // party size outside it (see lib/passengerMix.ts#resolveBookableBounds).
  const bookableBounds = useMemo(
    () => resolveBookableBounds({
      isPerGroup,
      groupBandMin: groupMinHeadcount,
      groupBandMax: groupMaxHeadcount,
      minParticipants: tour.minParticipants ?? null,
      maxParticipants: tour.maxParticipants ?? null,
    }),
    [isPerGroup, groupMinHeadcount, groupMaxHeadcount, tour.minParticipants, tour.maxParticipants],
  )

  // Seed the per-category counts / group headcount once. The caller's initial
  // counts take priority so the change modal can restore the current booking's
  // exact mix; otherwise the widget defaults to 2 adults (or the supplier's
  // minimum party size when that is higher, so the picker never starts below
  // what checkout would reject).
  const [categoryCounts, setCategoryCounts] = useState<Record<string, number>>(() => {
    if (isPerGroup) return {}
    if (options?.initialCounts && Object.keys(options.initialCounts).length > 0) {
      return { ...options.initialCounts }
    }
    return defaultCountsFor(travelerGroups, bookableBounds.min)
  })
  const [groupHeadcount, setGroupHeadcount] = useState(
    options?.initialHeadcount ?? Math.max(2, bookableBounds.min),
  )

  // Re-seed when the categories become available (the widget receives pricing
  // asynchronously) — React-recommended "adjust state during render" pattern,
  // guarded so it only runs when the categories actually change.
  const [prevCategories, setPrevCategories] = useState(travelerGroups)
  if (!isPerGroup && travelerGroups.length > 0 && prevCategories !== travelerGroups) {
    setPrevCategories(travelerGroups)
    setCategoryCounts(defaultCountsFor(travelerGroups, bookableBounds.min))
  }

  const totalTravelers = useMemo(() => {
    if (isPerGroup) return groupHeadcount
    return Object.values(categoryCounts).reduce((s, c) => s + (typeof c === 'number' && c > 0 ? c : 0), 0)
  }, [isPerGroup, groupHeadcount, categoryCounts])

  // The `travelers` payload shape the checkout API accepts: the three canonical
  // buckets plus any extra supplier categories under their own keys.
  const travelersPayload = useMemo(() => {
    if (isPerGroup) return { adults: totalTravelers }
    return sumCountsToBuckets(categoryCounts)
  }, [isPerGroup, totalTravelers, categoryCounts])

  const adultGroup = travelerGroups.find((g) => /adult/i.test(g.label))

  // A category's per-person price can depend on the TOTAL number of travelers
  // in the booking (GetYourGuide-style tiered pricing) — mirrors the backend's
  // calculateTourPrice() tier-matching logic (see lib/tierPricing.ts).
  const unitPriceFor = useCallback(
    (g: TravelerPricing) => resolveTierPrice(g, totalTravelers, g.price ?? 0),
    [totalTravelers],
  )
  const activeTierFor = useCallback(
    (g: TravelerPricing) => findActiveTier(g, totalTravelers),
    [totalTravelers],
  )

  // Matching flat-rate band for the current headcount, when perGroup.
  const matchingGroupBand = useMemo(() => {
    if (!isPerGroup || groupSizeBands.length === 0) return undefined
    return groupSizeBands.find((b) => totalTravelers >= b.from && totalTravelers <= b.to)
  }, [isPerGroup, groupSizeBands, totalTravelers])

  const lowestGroupBand = useMemo(() => {
    if (groupSizeBands.length === 0) return undefined
    return [...groupSizeBands].sort((a, b) => a.price - b.price)[0]
  }, [groupSizeBands])

  const activeGroupBandLabel = useMemo(
    () => groupBandLabel(matchingGroupBand),
    [matchingGroupBand],
  )

  const [prevGroupBands, setPrevGroupBands] = useState(groupSizeBands)
  if (isPerGroup && groupSizeBands.length > 0 && prevGroupBands !== groupSizeBands) {
    setPrevGroupBands(groupSizeBands)
    setGroupHeadcount((prev) => {
      const clamped = clampGroupHeadcount(prev, groupSizeBands)
      return Math.min(Math.max(clamped, bookableBounds.min), bookableBounds.max ?? clamped)
    })
  }

  const ageRangeLabel = (g?: TravelerPricing): string => {
    if (!g || (g.minAge == null && g.maxAge == null)) return ''
    if (g.minAge != null && g.maxAge != null) return `${g.minAge}-${g.maxAge} years`
    if (g.maxAge != null) return `Up to ${g.maxAge} years`
    return `${g.minAge}+ years`
  }

  // When a tier is currently active for a category, show the age range plus the
  // tier's headcount band so it's clear why the per-person price changed.
  const withTierNote = (baseLabel: string, tier: ReturnType<typeof findActiveTier>): string => {
    if (!tier) return baseLabel
    return `${baseLabel} · ${t('booking.groupOf', 'Group of {{range}}', { range: tierRangeLabel(tier) })}`
  }

  const formatPrice = (val: number) => (val > 0 ? `${currency.symbol}${val}` : t('booking.free'))

  // Passenger-mix rules (Viator parity): total min/max, disallowed categories,
  // and requires-adult supervision. Invalid mixes are surfaced and the "+"
  // steppers are disabled so a party can never be configured that checkout
  // would reject.
  const mixBounds = useMemo(
    () => ({ min: tour.minParticipants ?? null, max: tour.maxParticipants ?? null }),
    [tour.minParticipants, tour.maxParticipants],
  )
  const mixIssues = useMemo(
    () => (isPerGroup ? [] : validatePassengerMix(travelerGroups, categoryCounts, mixBounds)),
    [isPerGroup, travelerGroups, categoryCounts, mixBounds],
  )

  const canAddCount = (key: string) => {
    const category = travelerGroups.find((g) => categoryKey(g.label) === key)
    if (category?.notAllowed) return false
    if (mixBounds.max != null && totalTravelers >= mixBounds.max) return false
    if (category?.needsAdult && !mixIssues.some((i) => i.type === 'needsAdult')) return false
    // Simulate the addition and check the rules still pass.
    const next = { ...categoryCounts, [key]: (categoryCounts[key] ?? 0) + 1 }
    return validatePassengerMix(travelerGroups, next, mixBounds).length === 0
  }

  /** Whether the "+" stepper for a category is enabled (respects the supplier's
      maxParticipants for group pricing and the per-category caps otherwise). */
  const canIncrementCount = (key: string) => {
    if (isPerGroup) return groupHeadcount < (bookableBounds.max ?? Number.POSITIVE_INFINITY)
    if (!canAddCount(key)) return false
    const category = travelerGroups.find((g) => categoryKey(g.label) === key)
    const isAdultLike = category ? /adult/i.test(category.label) : false
    const cap = isAdultLike ? 50 : 9
    return (categoryCounts[key] ?? 0) < cap
  }

  /** Whether the "−" stepper for a category is enabled — removing a traveler
      must never drop the party below the supplier's minimum party size. */
  const canDecrementCount = (key: string) => {
    if (isPerGroup) return groupHeadcount > bookableBounds.min
    if (totalTravelers - 1 < bookableBounds.min) return false
    const category = travelerGroups.find((g) => categoryKey(g.label) === key)
    const isAdultLike = category ? /adult/i.test(category.label) : false
    const min = isAdultLike ? 1 : 0
    return (categoryCounts[key] ?? 0) > min
  }

  const increment = (key: string) => {
    if (isPerGroup) {
      if (canIncrementCount(key)) setGroupHeadcount(groupHeadcount + 1)
      return
    }
    if (!canAddCount(key)) return
    const category = travelerGroups.find((g) => categoryKey(g.label) === key)
    const isAdultLike = category ? /adult/i.test(category.label) : false
    const max = isAdultLike ? 50 : 9
    setCategoryCounts((prev) => ({
      ...prev,
      [key]: Math.min((prev[key] ?? 0) + 1, max),
    }))
  }

  const decrement = (key: string) => {
    if (isPerGroup) {
      if (canDecrementCount(key)) setGroupHeadcount(groupHeadcount - 1)
      return
    }
    if (!canDecrementCount(key)) return
    const category = travelerGroups.find((g) => categoryKey(g.label) === key)
    const isAdultLike = category ? /adult/i.test(category.label) : false
    const min = isAdultLike ? 1 : 0
    setCategoryCounts((prev) => ({
      ...prev,
      [key]: Math.max((prev[key] ?? 0) - 1, min),
    }))
  }

  // Client-side subtotal — mirrors what checkout will charge before any
  // discount. Used as the displayed subtotal until the API answers.
  const clientSubtotal = useMemo(() => {
    if (isPerGroup) return matchingGroupBand?.price ?? 0
    return travelerGroups.reduce((sum, g) => {
      const count = categoryCounts[categoryKey(g.label)] ?? 0
      return sum + (count > 0 ? unitPriceFor(g) * count : 0)
    }, 0)
  }, [isPerGroup, travelerGroups, categoryCounts, matchingGroupBand, unitPriceFor])

  const anyTieredPricing = !isPerGroup && travelerGroups.some((g) => hasTieredPricing(g))

  const travelerOptions: TravelerOption[] = isPerGroup
    ? [
        {
          label: t('booking.travelers'),
          age: matchingGroupBand ? activeGroupBandLabel : t('booking.perGroupHeadcount', 'Group headcount'),
          price: matchingGroupBand ? formatPrice(matchingGroupBand.price) : '',
          lineTotal: matchingGroupBand?.price ?? 0,
          count: groupHeadcount,
          key: 'travelers',
        },
      ]
    : travelerGroups.map((g) => {
        const key = categoryKey(g.label)
        const count = categoryCounts[key] ?? 0
        const unit = unitPriceFor(g)
        return {
          label: g.label,
          age: withTierNote(ageRangeLabel(g) || '', activeTierFor(g)),
          price: unit > 0 ? formatPrice(unit) : t('booking.free'),
          lineTotal: unit * count,
          count,
          key,
        }
      })

  return {
    isPerGroup,
    groupSizeBands,
    travelerGroups,
    categoryCounts,
    setCategoryCounts,
    groupHeadcount,
    setGroupHeadcount,
    totalTravelers,
    travelersPayload,
    adultGroup,
    unitPriceFor,
    activeTierFor,
    matchingGroupBand,
    lowestGroupBand,
    groupMinHeadcount,
    groupMaxHeadcount,
    bookableBounds,
    activeGroupBandLabel,
    mixBounds,
    mixIssues,
    canAddCount,
    canIncrementCount,
    canDecrementCount,
    increment,
    decrement,
    clientSubtotal,
    anyTieredPricing,
    formatPrice,
    travelerOptions,
  }
}
