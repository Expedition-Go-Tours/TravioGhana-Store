import { useState, useEffect, useRef } from 'react'
import './CountdownTimer.tsx.css'

interface CountdownTimerProps {
  deadline: Date | null
  label?: string
}

interface Segment {
  value: string
  unit: string
}

function padTwo(n: number): string {
  return String(n).padStart(2, '0')
}

function computeRemaining(deadline: Date | null): Segment[] | null {
  if (!deadline) return null

  const diff = deadline.getTime() - Date.now()
  if (diff <= 0) return null

  const totalSeconds = Math.max(0, Math.floor(diff / 1000))
  const totalMinutes = Math.floor(totalSeconds / 60)
  const totalHours = Math.floor(totalMinutes / 60)
  const days = Math.floor(totalHours / 24)
  const hours = totalHours % 24
  const minutes = totalMinutes % 60
  const seconds = totalSeconds % 60

  const segs: Segment[] = []
  if (days > 0) segs.push({ value: String(days), unit: days === 1 ? 'day' : 'days' })
  segs.push({ value: padTwo(hours), unit: hours === 1 ? 'hour' : 'hours' })
  segs.push({ value: padTwo(minutes), unit: minutes === 1 ? 'minute' : 'minutes' })
  segs.push({ value: padTwo(seconds), unit: seconds === 1 ? 'second' : 'seconds' })
  return segs
}

export default function CountdownTimer({ deadline, label = 'Deals expire in' }: CountdownTimerProps) {
  const [remaining, setRemaining] = useState<Segment[] | null>(() => computeRemaining(deadline))
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    if (intervalRef.current) clearInterval(intervalRef.current)

    const tick = () => {
      const updated = computeRemaining(deadline)
      setRemaining(updated)
      if (!updated && intervalRef.current) clearInterval(intervalRef.current)
    }

    intervalRef.current = setInterval(tick, 1000)
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current)
    }
  }, [deadline])

  if (!remaining) return null

  return (
    <div className="countdown-timer" role="timer" aria-live="polite">
      <span className="countdown-label">{label}</span>
      <span className="countdown-value">
        {remaining.map((seg, i) => (
          <span key={seg.unit} className="countdown-group">
            <span className="countdown-num">{seg.value}</span>
            <span className="countdown-unit">{seg.unit}</span>
            {i < remaining.length - 1 && <span className="countdown-sep">:</span>}
          </span>
        ))}
      </span>
    </div>
  )
}
