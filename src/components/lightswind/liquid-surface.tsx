import { useEffect, useRef } from 'react'

export interface LiquidSurfaceProps {
  className?: string
  heading?: string
  scheme?: number
  speed?: number
  theme?: 'light' | 'dark'
}

interface Wave {
  amplitude: number
  frequency: number
  phase: number
  speed: number
  yOffset: number
  color: string
}

const LIGHT_SCHEMES: Record<number, string[]> = {
  1: ['rgba(19, 122, 46, 0.15)', 'rgba(34, 197, 94, 0.12)', 'rgba(74, 222, 128, 0.1)', 'rgba(134, 239, 172, 0.08)'],
  2: ['rgba(59, 130, 246, 0.15)', 'rgba(96, 165, 250, 0.12)', 'rgba(147, 197, 253, 0.1)', 'rgba(191, 219, 254, 0.08)'],
  3: ['rgba(168, 85, 247, 0.15)', 'rgba(192, 132, 252, 0.12)', 'rgba(216, 180, 254, 0.1)', 'rgba(237, 233, 254, 0.08)'],
  4: ['rgba(249, 115, 22, 0.15)', 'rgba(251, 146, 60, 0.12)', 'rgba(253, 186, 116, 0.1)', 'rgba(254, 215, 170, 0.08)'],
}

const DARK_SCHEMES: Record<number, string[]> = {
  1: ['rgba(19, 122, 46, 0.25)', 'rgba(34, 197, 94, 0.2)', 'rgba(74, 222, 128, 0.15)', 'rgba(134, 239, 172, 0.1)'],
  2: ['rgba(59, 130, 246, 0.25)', 'rgba(96, 165, 250, 0.2)', 'rgba(147, 197, 253, 0.15)', 'rgba(191, 219, 254, 0.1)'],
  3: ['rgba(168, 85, 247, 0.25)', 'rgba(192, 132, 252, 0.2)', 'rgba(216, 180, 254, 0.15)', 'rgba(237, 233, 254, 0.1)'],
  4: ['rgba(249, 115, 22, 0.25)', 'rgba(251, 146, 60, 0.2)', 'rgba(253, 186, 116, 0.15)', 'rgba(254, 215, 170, 0.1)'],
}

export default function LiquidSurface({
  className,
  heading = 'LIQUID SURFACE',
  scheme = 1,
  speed = 1.0,
  theme = 'light',
}: LiquidSurfaceProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const wavesRef = useRef<Wave[]>([])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const dpr = Math.min(window.devicePixelRatio || 1, 2)
    let raf = 0
    let width = 0
    let height = 0
    let last = performance.now()
    let time = 0

    const schemes = theme === 'dark' ? DARK_SCHEMES : LIGHT_SCHEMES
    const colors = schemes[scheme] || schemes[1]

    const createWaves = (): Wave[] => {
      return colors.map((color, i) => ({
        amplitude: 30 + i * 15,
        frequency: 0.008 + i * 0.002,
        phase: (i * Math.PI) / 4,
        speed: (0.3 + i * 0.1) * speed,
        yOffset: 0.2 + i * 0.18,
        color,
      }))
    }

    wavesRef.current = createWaves()

    const resize = () => {
      const rect = canvas.getBoundingClientRect()
      width = Math.max(1, rect.width)
      height = Math.max(1, rect.height)
      canvas.width = Math.round(width * dpr)
      canvas.height = Math.round(height * dpr)
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    }

    const drawWave = (wave: Wave, t: number) => {
      ctx.beginPath()
      ctx.moveTo(0, height)

      for (let x = 0; x <= width; x += 2) {
        const baseY = height * wave.yOffset
        const y =
          baseY +
          Math.sin(x * wave.frequency + t * wave.speed + wave.phase) * wave.amplitude +
          Math.sin(x * wave.frequency * 0.5 + t * wave.speed * 0.7) * wave.amplitude * 0.5
        ctx.lineTo(x, y)
      }

      ctx.lineTo(width, height)
      ctx.closePath()
      ctx.fillStyle = wave.color
      ctx.fill()
    }

    const render = (now: number) => {
      const dt = Math.min(now - last, 50)
      last = now
      time += dt * 0.001

      ctx.clearRect(0, 0, width, height)

      for (const wave of wavesRef.current) {
        drawWave(wave, time)
      }
    }

    const loop = (now: number) => {
      render(now)
      raf = requestAnimationFrame(loop)
    }

    resize()
    window.addEventListener('resize', resize)
    raf = requestAnimationFrame(loop)

    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener('resize', resize)
    }
  }, [scheme, speed, theme])

  return (
    <div className={className} style={{ position: 'absolute', inset: 0, overflow: 'hidden' }}>
      <canvas
        ref={canvasRef}
        aria-hidden="true"
        style={{ width: '100%', height: '100%', display: 'block' }}
      />
      {heading && (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            pointerEvents: 'none',
          }}
        >
        </div>
      )}
    </div>
  )
}
