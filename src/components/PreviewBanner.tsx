import { useLayoutEffect, useRef } from 'react'
import { AlertTriangle } from 'lucide-react'
import { detectPreview, PREVIEW_BANNER_TEXT } from '../lib/previewEnvironment'
import './PreviewBanner.css'

/**
 * A fixed, non-dismissible strip at the top of every preview page.
 *
 * The storefront's navbar is fixed too, so the banner publishes its measured
 * height as --preview-banner-height: the page reserves that space at the top
 * and the navbar sits below it. On production no banner renders, the variable
 * defaults to 0px, and every offset keeps its existing value.
 *
 * Height is measured rather than hard-coded because the copy wraps on phones.
 */
export default function PreviewBanner() {
  const reason = detectPreview()
  const ref = useRef<HTMLDivElement>(null)

  useLayoutEffect(() => {
    if (!reason) return undefined
    const el = ref.current
    if (!el) return undefined

    const root = document.documentElement
    const apply = () => root.style.setProperty('--preview-banner-height', `${el.offsetHeight}px`)
    apply()

    const observer = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(apply) : null
    observer?.observe(el)

    return () => {
      observer?.disconnect()
      root.style.removeProperty('--preview-banner-height')
    }
  }, [reason])

  if (!reason) return null

  return (
    <div
      ref={ref}
      role="region"
      aria-label="Preview environment"
      data-preview-reason={reason}
      className="preview-banner"
    >
      <AlertTriangle aria-hidden="true" className="preview-banner__icon" />
      <span>{PREVIEW_BANNER_TEXT}</span>
    </div>
  )
}
