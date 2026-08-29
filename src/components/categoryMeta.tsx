// Maps a tour's product type / category into a badge-friendly icon + label
// + accent color. The supplier chooses "Tour" / "Activity" / "Transport" in
// Step 2 of the product builder (Travio Ghana-Supplier/.../Step02Category.jsx)
// — that's the canonical taxonomy this maps against. Legacy mock listing
// data (e.g. "Accra · Day trip") doesn't match any of the three, so it
// falls back to a plain neutral tag badge instead of guessing a type.
import type { ComponentType } from 'react'
import { Compass, Zap, Bus, Tag } from 'lucide-react'
import type { LucideProps } from 'lucide-react'

export interface CategoryMeta {
  label: string
  Icon: ComponentType<LucideProps>
  variant: 'tour' | 'activity' | 'transport' | 'default'
}

export function getCategoryMeta(category?: string | null): CategoryMeta | null {
  if (!category) return null
  // Coerce defensively: stale localStorage continue-planning items or legacy
  // data can carry a truthy non-string category, which would crash the card.
  const normalized = String(category).trim().toLowerCase()

  if (normalized === 'tour') {
    return { label: 'Tour', Icon: Compass, variant: 'tour' }
  }
  if (normalized === 'activity') {
    // Zap reads as "action / energy", a better fit for an interactive
    // activity than Sparkles, which leans decorative/magic.
    return { label: 'Activity', Icon: Zap, variant: 'activity' }
  }
  if (normalized === 'transport') {
    return { label: 'Transport', Icon: Bus, variant: 'transport' }
  }

  // Legacy/free-text category (e.g. "Accra · Day trip") — show as-is with a
  // neutral tag icon rather than mapping to one of the three known types.
  const label = String(category)
  return {
    label: label.charAt(0).toUpperCase() + label.slice(1),
    Icon: Tag,
    variant: 'default',
  }
}
