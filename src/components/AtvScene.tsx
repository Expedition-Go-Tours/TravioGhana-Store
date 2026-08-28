import { motion } from 'framer-motion'
import './AtvScene.css'

/**
 * Premium animated ATV / quad-bike for the loading/transition screen.
 *  - spinning wheels (blurred spoke discs over each wheel hub)
 *  - gentle forward bounce + terrain tilt
 *  - subtle suspension compression (squash on landing)
 *  - soft ground shadow that reacts to the bounce
 *
 * Uses the flat vector art at /public/transit/truck.png. Wheel overlay
 * positions are CSS-tunable via the `.atv-wheel-*` rules.
 */

const ATV_SRC = '/transit/truck.png'

interface AtvSceneProps {
  onError?: () => void
}

export default function AtvScene({ onError }: AtvSceneProps) {
  return (
    <div className="atv-scene">
      {/* Bouncing rig */}
      <motion.div
        className="atv-rig"
        animate={{ y: [0, -12, 0], rotate: [0, -1.4, 1.4, 0] }}
        transition={{ duration: 1.2, repeat: Infinity, ease: 'easeInOut' }}
      >
        {/* Suspension compression (squash on landing, origin at wheels) */}
        <motion.div
          className="atv-body"
          animate={{ scaleY: [1, 0.965, 1], scaleX: [1, 1.02, 1] }}
          transition={{ duration: 1.2, repeat: Infinity, ease: 'easeInOut' }}
        >
          <img
            src={ATV_SRC}
            alt=""
            className="atv-img"
            onError={onError}
            draggable={false}
          />

          {/* Spinning wheels — blurred spoke discs over each hub */}
          <motion.span
            className="atv-wheel atv-wheel-rear"
            animate={{ rotate: 360 }}
            transition={{ duration: 0.5, repeat: Infinity, ease: 'linear' }}
          />
          <motion.span
            className="atv-wheel atv-wheel-front"
            animate={{ rotate: 360 }}
            transition={{ duration: 0.5, repeat: Infinity, ease: 'linear' }}
          />
        </motion.div>
      </motion.div>

      {/* Ground shadow — reacts to the bounce */}
      <motion.span
        className="atv-shadow"
        animate={{ scaleX: [1, 0.82, 1], opacity: [0.3, 0.18, 0.3] }}
        transition={{ duration: 1.2, repeat: Infinity, ease: 'easeInOut' }}
      />
    </div>
  )
}
