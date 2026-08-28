import { motion } from 'framer-motion'
import './HelicopterScene.css'

/**
 * Premium animated helicopter for the loading/transition screen.
 *  - gentle vertical floating bob (ease-in-out, seamless loop)
 *  - motion-blurred spinning main + tail rotors (translucent discs)
 *  - subtle landing-skid vibration
 *  - soft ground shadow that expands/contracts inversely with the hover
 *
 * Uses the flat vector art at /public/transit/helicopter.png. Rotor overlay
 * positions are CSS-tunable via the `.heli-rotor-*` rules.
 */

const HELI_SRC = '/transit/helicopter.png'

interface HelicopterSceneProps {
  onError?: () => void
}

export default function HelicopterScene({ onError }: HelicopterSceneProps) {
  return (
    <div className="heli-scene">
      {/* Floating rig (body + rotors bob together) */}
      <motion.div
        className="heli-rig"
        animate={{ y: [0, -16, 0] }}
        transition={{ duration: 2.4, repeat: Infinity, ease: 'easeInOut' }}
      >
        {/* Skid vibration */}
        <motion.div
          className="heli-body"
          animate={{ rotate: [0, -0.5, 0.5, 0], x: [0, -0.7, 0.7, 0] }}
          transition={{ duration: 0.16, repeat: Infinity, ease: 'linear' }}
        >
          <img
            src={HELI_SRC}
            alt=""
            className="heli-img"
            onError={onError}
            draggable={false}
          />

          {/* Main rotor — edge-on blurred spinning disc */}
          <motion.span
            className="heli-rotor-main"
            animate={{ opacity: [0.12, 0.4, 0.12], scaleX: [1, 1.05, 1] }}
            transition={{ duration: 0.14, repeat: Infinity, ease: 'easeInOut' }}
          />

          {/* Tail rotor — fast spinning blurred disc */}
          <motion.span
            className="heli-rotor-tail"
            animate={{ rotate: 360 }}
            transition={{ duration: 0.22, repeat: Infinity, ease: 'linear' }}
          />
        </motion.div>
      </motion.div>

      {/* Ground shadow — contracts as the helicopter rises */}
      <motion.span
        className="heli-shadow"
        animate={{ scaleX: [1, 0.72, 1], opacity: [0.32, 0.16, 0.32] }}
        transition={{ duration: 2.4, repeat: Infinity, ease: 'easeInOut' }}
      />
    </div>
  )
}
