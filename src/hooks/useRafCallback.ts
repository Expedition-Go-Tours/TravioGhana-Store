import { useCallback, useEffect, useRef } from 'react'

/**
 * Coalesces high-frequency event callbacks (scroll, resize, pointer moves)
 * into one invocation per animation frame. The latest callback identity is
 * always used, so consumers can pass fresh closures without re-subscribing.
 */
export default function useRafCallback<Args extends unknown[]>(callback: (...args: Args) => void) {
  const frame = useRef<number | null>(null)
  const latest = useRef(callback)
  const argsRef = useRef<Args | null>(null)

  useEffect(() => {
    latest.current = callback
  })

  useEffect(
    () => () => {
      if (frame.current !== null) cancelAnimationFrame(frame.current)
    },
    [],
  )

  return useCallback((...args: Args) => {
    argsRef.current = args
    if (frame.current !== null) return
    frame.current = requestAnimationFrame(() => {
      frame.current = null
      if (argsRef.current) latest.current(...argsRef.current)
    })
  }, [])
}
