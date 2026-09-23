import { useEffect, useRef } from 'react'

export interface CosmicDustProps {
  className?: string
  /** Number of dust specks drifting across the canvas. */
  particleCount?: number
  /** Overall drift speed multiplier (1 = normal). */
  speedMultiplier?: number
  /** Base particle radius in px (each speck jitters around it). */
  particleSize?: number
  /** Color palette: follow the OS, or force light/dark. */
  theme?: 'system' | 'light' | 'dark'
}

interface Particle {
  x: number
  y: number
  vx: number
  vy: number
  size: number
  phase: number
  twinkleRate: number
}

interface Palette {
  core: [number, number, number]
  halo: [number, number, number]
}

const LIGHT_PALETTE: Palette = { core: [71, 85, 105], halo: [100, 116, 139] }
const DARK_PALETTE: Palette = { core: [226, 232, 240], halo: [148, 163, 184] }

export default function CosmicDust({
  className,
  particleCount = 150,
  speedMultiplier = 1.0,
  particleSize = 1.5,
  theme = 'system',
}: CosmicDustProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const dpr = Math.min(window.devicePixelRatio || 1, 2)
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches

    let raf = 0
    let width = 0
    let height = 0
    let last = performance.now()
    let palette: Palette = LIGHT_PALETTE

    const resolveTheme = (): 'light' | 'dark' => {
      if (theme !== 'system') return theme
      return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
    }
    const applyPalette = () => {
      palette = resolveTheme() === 'dark' ? DARK_PALETTE : LIGHT_PALETTE
    }
    applyPalette()

    const particles: Particle[] = []
    const reseed = () => {
      particles.length = 0
      for (let i = 0; i < particleCount; i += 1) {
        particles.push({
          x: Math.random() * width,
          y: Math.random() * height,
          vx: (Math.random() - 0.5) * 0.22,
          vy: (Math.random() - 0.5) * 0.22,
          size: particleSize * (0.5 + Math.random() * 1.3),
          phase: Math.random() * Math.PI * 2,
          twinkleRate: 0.6 + Math.random() * 1.6,
        })
      }
    }

    const resize = () => {
      const rect = canvas.getBoundingClientRect()
      width = Math.max(1, rect.width)
      height = Math.max(1, rect.height)
      canvas.width = Math.round(width * dpr)
      canvas.height = Math.round(height * dpr)
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      reseed()
    }

    const render = (now: number) => {
      const dt = Math.min(now - last, 50)
      last = now
      ctx.clearRect(0, 0, width, height)

      const drift = speedMultiplier * (dt / 16.7)
      for (const p of particles) {
        p.x += p.vx * drift
        p.y += p.vy * drift
        p.phase += p.twinkleRate * 0.016 * drift
        if (p.x < -12) p.x = width + 12
        if (p.x > width + 12) p.x = -12
        if (p.y < -12) p.y = height + 12
        if (p.y > height + 12) p.y = -12

        const twinkle = 0.55 + 0.45 * Math.sin(p.phase)
        const [cr, cg, cb] = palette.core
        const [hr, hg, hb] = palette.halo

        ctx.fillStyle = `rgba(${hr},${hg},${hb},${0.09 * twinkle})`
        ctx.beginPath()
        ctx.arc(p.x, p.y, p.size * 3.2, 0, Math.PI * 2)
        ctx.fill()

        ctx.fillStyle = `rgba(${cr},${cg},${cb},${0.85 * twinkle})`
        ctx.beginPath()
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2)
        ctx.fill()
      }
    }

    const loop = (now: number) => {
      render(now)
      raf = requestAnimationFrame(loop)
    }

    const media = window.matchMedia('(prefers-color-scheme: dark)')
    const onThemeChange = () => {
      if (theme !== 'system') return
      applyPalette()
    }

    resize()
    window.addEventListener('resize', resize)
    media.addEventListener('change', onThemeChange)

    if (reduceMotion) {
      render(performance.now())
    } else {
      raf = requestAnimationFrame(loop)
    }

    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener('resize', resize)
      media.removeEventListener('change', onThemeChange)
    }
  }, [particleCount, speedMultiplier, particleSize, theme])

  return (
    <canvas
      ref={canvasRef}
      className={className}
      aria-hidden="true"
      style={{ width: '100%', height: '100%', display: 'block' }}
    />
  )
}
