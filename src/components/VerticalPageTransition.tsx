import type { ReactNode } from 'react'
import { motion, useReducedMotion } from 'framer-motion'
import { useLocation } from 'react-router-dom'
import { isVerticalSwitchEnter } from '../lib/useVerticalScrollReset'

interface VerticalPageTransitionProps {
  children: ReactNode
  className?: string
}

/**
 * Slide the page body in beneath the shared Hero.
 *
 * Switching verticals must not move the hero: the headline, search card and
 * tab row are laid out identically on both pages, so animating them reads as
 * the whole screen lurching. Only the content below the hero travels.
 *
 * Direction follows the tab order — Tours sits left of Restaurants, so Tours
 * enters from the left and Restaurants from the right. The animation runs only
 * for a real tab switch (flagged by prepareVerticalSwitch), never for ordinary
 * links, the first load or Back/Forward. Honours reduced-motion.
 */
export default function VerticalPageTransition({ children, className }: VerticalPageTransitionProps) {
  const { pathname } = useLocation()
  const reduceMotion = useReducedMotion()
  const isSwitch = isVerticalSwitchEnter()
  const fromLeft = !pathname.startsWith('/restaurants')
  // A full-width page needs a smaller travel on phones than on desktop.
  const distance = typeof window !== 'undefined' && window.innerWidth <= 768 ? 22 : 36

  return (
    <motion.div
      className={className}
      initial={
        isSwitch && !reduceMotion ? { x: fromLeft ? -distance : distance, opacity: 0.92 } : false
      }
      animate={{ x: 0, opacity: 1 }}
      transition={{ type: 'spring', stiffness: 320, damping: 32, mass: 0.85 }}
    >
      {children}
    </motion.div>
  )
}
