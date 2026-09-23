import type { Variants } from 'framer-motion'

/**
 * Shared "subtle & smooth" motion recipe for the public support pages
 * (Help Centre, Contact Us, FAQ). Mirrors the About Us / Foundation pages:
 * short ease-out fades, mild vertical lift, one-shot scroll reveals.
 */
export const revealViewport = { once: true, margin: '-80px' } as const

/** Single element fade-up used for section and card reveals. */
export const fadeUp: Variants = {
  hidden: { opacity: 0, y: 22 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.5, ease: 'easeOut' } },
}

/**
 * Opacity-only reveal. Used where a transform would interfere with scroll
 * anchoring (e.g. FAQ answers targeted by #faq-<id> deep links).
 */
export const fadeIn: Variants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { duration: 0.45, ease: 'easeOut' } },
}

/** Container that staggers its direct children. */
export const stagger: Variants = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.06, delayChildren: 0.04 } },
}

/** Child item for a `stagger` container. */
export const staggerItem: Variants = {
  hidden: { opacity: 0, y: 14 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.4, ease: 'easeOut' } },
}

/** Opacity-only child item for a `stagger` container (scroll-anchor safe). */
export const staggerItemFade: Variants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { duration: 0.35, ease: 'easeOut' } },
}
