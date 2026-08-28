import { motion } from 'framer-motion'
import { Check, AlertCircle } from 'lucide-react'

interface StepBadgeProps {
  number: number
  active: boolean
  completed: boolean
  error?: boolean
}

export default function StepBadge({ number, active, completed, error }: StepBadgeProps) {
  return (
    <motion.div
      layout
      className="relative shrink-0"
      transition={{ type: 'spring', stiffness: 120, damping: 18 }}
    >
      <motion.div
        layout
        animate={{
          scale: active ? 1 : 0.96,
          backgroundColor: completed || active ? '#179237' : 'transparent',
          borderColor: error && !completed ? '#e11d48' : completed || active ? '#179237' : '#cbd5e1',
          color: error && !completed ? '#e11d48' : completed || active ? '#fff' : '#94a3b8',
        }}
        transition={{ type: 'spring', stiffness: 150, damping: 18 }}
        className="grid size-9 place-items-center rounded-full text-sm font-bold border-2"
      >
        {completed ? (
          <motion.span
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ type: 'spring', stiffness: 200, damping: 12 }}
          >
            <Check className="size-4" />
          </motion.span>
        ) : error ? (
          <AlertCircle className="size-4" strokeWidth={2.5} />
        ) : (
          number
        )}
      </motion.div>
    </motion.div>
  )
}
