import { startTransition, useEffect, useRef, useState, type ReactNode } from 'react'
import { isScrollRestoring, SCROLL_RESTORE_EVENT } from '../lib/scrollRestoreSignal'

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

    // A Back restore jumps straight to an offset. Mount now instead of waiting
    // for an intersection we are about to skip, or the jump lands in a hole.
    const onRestore = () => setMounted(true)
    if (isScrollRestoring()) {
      onRestore()
      return
    }
    window.addEventListener(SCROLL_RESTORE_EVENT, onRestore)

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          observer.disconnect()
          window.removeEventListener(SCROLL_RESTORE_EVENT, onRestore)
          // Interruptible mount: keeps a heavy section's first render from
          // becoming one long task while the user is scrolling.
          startTransition(() => setMounted(true))
        }
      },
      { rootMargin }
    )
    observer.observe(el)
    return () => {
      observer.disconnect()
      window.removeEventListener(SCROLL_RESTORE_EVENT, onRestore)
    }
  }, [rootMargin])

  return <div ref={ref}>{mounted ? children : null}</div>
}
