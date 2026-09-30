import { useCallback, useEffect, useRef, useState } from 'react'

interface CopyButtonProps {
  /** Text placed on the clipboard. */
  value: string
  /** Button label in its resting state. */
  label?: string
  /** Optional extra class so each host page can style it. */
  className?: string
}

/**
 * Copy-to-clipboard control for the partner/press resources pages.
 *
 * The async Clipboard API is not available everywhere (insecure contexts, some
 * embedded webviews), so the legacy textarea + execCommand path is kept as a
 * fallback. When both fail the button simply stays quiet — the snippet is still
 * selectable text on the page, so nothing is lost.
 */
export default function CopyButton({ value, label = 'Copy', className = '' }: CopyButtonProps) {
  const [copied, setCopied] = useState(false)
  const timer = useRef<number | null>(null)

  useEffect(
    () => () => {
      if (timer.current) window.clearTimeout(timer.current)
    },
    [],
  )

  const copy = useCallback(async () => {
    const markCopied = () => {
      setCopied(true)
      if (timer.current) window.clearTimeout(timer.current)
      timer.current = window.setTimeout(() => setCopied(false), 2000)
    }

    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(value)
        markCopied()
        return
      }
      const area = document.createElement('textarea')
      area.value = value
      area.setAttribute('readonly', '')
      area.style.position = 'fixed'
      area.style.opacity = '0'
      document.body.appendChild(area)
      area.select()
      const ok = document.execCommand('copy')
      document.body.removeChild(area)
      if (ok) markCopied()
    } catch {
      /* clipboard unavailable — the snippet remains selectable */
    }
  }, [value])

  return (
    <button
      type="button"
      className={className}
      onClick={copy}
      aria-live="polite"
      data-copied={copied || undefined}
    >
      {copied ? 'Copied' : label}
    </button>
  )
}
