import { useRef, useEffect, type ReactNode } from 'react'

interface RevealOnScrollProps {
  children: ReactNode
  className?: string
  threshold?: number
  delay?: number
}

/**
 * Wrapper that fades/slides its children in when they scroll into view.
 * Uses IntersectionObserver — no JS animation library needed.
 */
export default function RevealOnScroll({
  children,
  className = '',
  threshold = 0.1,
  delay = 0,
}: RevealOnScrollProps) {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const el = ref.current
    if (!el) return

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setTimeout(() => {
              entry.target.classList.add('eg-visible')
            }, delay)
            observer.unobserve(entry.target)
          }
        })
      },
      { threshold }
    )

    observer.observe(el)
    return () => observer.disconnect()
  }, [threshold, delay])

  return (
    <div ref={ref} className={`eg-reveal ${className}`}>
      {children}
    </div>
  )
}