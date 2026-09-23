import { startTransition, useEffect, useRef, useState, type ReactNode } from 'react'

interface MountOnViewProps {
  children: ReactNode
  rootMargin?: string
}

export default function MountOnView({ children, rootMargin = '600px' }: MountOnViewProps) {
  const ref = useRef<HTMLDivElement>(null)
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    const el = ref.current
    if (!el) return

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          observer.disconnect()
          // Interruptible mount: keeps a heavy section's first render from
          // becoming one long task while the user is scrolling.
          startTransition(() => setMounted(true))
        }
      },
      { rootMargin }
    )
    observer.observe(el)
    return () => observer.disconnect()
  }, [rootMargin])

  return <div ref={ref}>{mounted ? children : null}</div>
}
