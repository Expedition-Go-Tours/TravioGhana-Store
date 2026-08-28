import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { motion } from 'framer-motion'
import HelicopterScene from './HelicopterScene'
import AtvScene from './AtvScene'
import './BookingTransition.css'

/**
 * Full-screen transition played between clicking "Book Now" and landing on the
 * booking page. The chosen vehicle stays fixed in the centre while the
 * background (clouds + ground) scrolls to portray motion.
 *
 * Rendered via a portal to <body> so it sits above the navbar and all page
 * chrome (gallery buttons, share, wishlist, etc.). The vehicle cycles per
 * booking (helicopter → tram → truck → repeat) via `vehicleIndex`.
 * Vehicle art lives in /public/transit/.
 */

export const TRANSIT_VEHICLES = [
  '/transit/helicopter.png',
  '/transit/tram.png',
  '/transit/truck.png',
]

const TOTAL_MS = 2600

interface BookingTransitionProps {
  onDone: () => void
  vehicleIndex: number
}

// Background clouds — varied size / position / speed for a parallax feel.
const CLOUDS = [
  { top: '12%', size: 120, duration: 3.6, delay: 0 },
  { top: '22%', size: 80, duration: 4.6, delay: 0.8 },
  { top: '34%', size: 150, duration: 3.0, delay: 1.4 },
  { top: '60%', size: 90, duration: 4.0, delay: 0.3 },
  { top: '72%', size: 130, duration: 3.3, delay: 1.1 },
]

export default function BookingTransition({ onDone, vehicleIndex }: BookingTransitionProps) {
  const [errored, setErrored] = useState(false)
  const src = TRANSIT_VEHICLES[vehicleIndex % TRANSIT_VEHICLES.length]

  useEffect(() => {
    const timer = setTimeout(onDone, TOTAL_MS)
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      clearTimeout(timer)
      document.body.style.overflow = prevOverflow
    }
  }, [onDone])

  const overlay = (
    <motion.div
      className="bt-overlay"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.3, ease: 'easeInOut' }}
    >
      {/* Moving background clouds (right → left = forward motion) */}
      {CLOUDS.map((c, i) => (
        <motion.span
          key={`cloud-${i}`}
          className="bt-cloud"
          style={{ top: c.top, width: c.size, height: c.size * 0.5 }}
          initial={{ x: '112vw' }}
          animate={{ x: '-30vw' }}
          transition={{ duration: c.duration, delay: c.delay, repeat: Infinity, ease: 'linear' }}
        />
      ))}

      {/* Speed lines just behind the vehicle */}
      {[0, 1, 2, 3].map((i) => (
        <motion.span
          key={`line-${i}`}
          className="bt-speedline"
          style={{ top: `${42 + i * 6}%` }}
          initial={{ x: '112vw', opacity: 0 }}
          animate={{ x: '-30vw', opacity: [0, 0.6, 0] }}
          transition={{ duration: 0.9, delay: i * 0.14, repeat: Infinity, ease: 'linear' }}
        />
      ))}

      {/* Fixed vehicle — premium scenes for helicopter & ATV, image otherwise */}
      {!errored && (() => {
        const idx = vehicleIndex % TRANSIT_VEHICLES.length
        if (idx === 0) return <HelicopterScene onError={() => setErrored(true)} />
        if (idx === 2) return <AtvScene onError={() => setErrored(true)} />
        return (
          <motion.img
            key={src}
            src={src}
            alt=""
            className="bt-vehicle"
            onError={() => setErrored(true)}
            animate={{ y: [0, -10, 0] }}
            transition={{ duration: 1.4, repeat: Infinity, ease: 'easeInOut' }}
          />
        )
      })()}

      <div className="bt-caption">
        <span>Preparing your booking</span>
        <span className="bt-dots">
          {[0, 1, 2].map((i) => (
            <motion.span
              key={i}
              className="bt-dot"
              animate={{ opacity: [0.2, 1, 0.2], y: [0, -3, 0] }}
              transition={{ duration: 0.9, repeat: Infinity, ease: 'easeInOut', delay: i * 0.15 }}
            />
          ))}
        </span>
      </div>

      <div className="bt-bar">
        <motion.span
          className="bt-bar-fill"
          initial={{ scaleX: 0 }}
          animate={{ scaleX: 1 }}
          transition={{ duration: TOTAL_MS / 1000, ease: 'linear' }}
        />
      </div>
    </motion.div>
  )

  return createPortal(overlay, document.body)
}
