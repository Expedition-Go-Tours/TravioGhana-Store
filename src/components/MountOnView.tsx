import { useEffect, useRef, useState, type ReactNode } from 'react'

interface MountOnViewProps {
  children: ReactNode
  rootMargin?: string
}

export default function MountOnView({ children, rootMargin = '1000px' }: MountOnViewProps) {
  const ref = useRef<HTMLDivElement>(null)
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    const el = ref.current
    if (!el) return

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setMounted(true)
          observer.disconnect()
        }
      },
      { rootMargin }
    )
    observer.observe(el)
    return () => observer.disconnect()
  }, [rootMargin])

  return <div ref={ref}>{mounted ? children : null}</div>
}
