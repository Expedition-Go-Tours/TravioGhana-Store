import { useEffect, useRef, useState, type ComponentType } from 'react'

interface LazySectionProps {
  load: () => Promise<{ default: ComponentType<any> }>
  props?: Record<string, any>
  placeholder?: React.ReactNode
}

export default function LazySection({ load, props = {} }: LazySectionProps) {
  const ref = useRef<HTMLDivElement>(null)
  const [Component, setComponent] = useState<ComponentType<any> | null>(null)

  useEffect(() => {
    const el = ref.current
    if (!el) return

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          load().then((mod) => setComponent(() => mod.default))
          observer.disconnect()
        }
      },
      { rootMargin: '200px' }
    )
    observer.observe(el)
    return () => observer.disconnect()
  }, [load])

  return (
    <div ref={ref}>
      {Component ? <Component {...props} /> : <div className="lazy-section-skeleton" />}
    </div>
  )
}
