import './SupportPageSkeleton.css'

/**
 * Suspense fallback for the lazy support routes. Mirrors the hero + section
 * layout of Help Centre / Contact Us / FAQ so a cold navigation shows a
 * shaped shimmer instead of a centered spinner.
 */
export default function SupportPageSkeleton() {
  return (
    <div className="support-page sh-hub support-skeleton" role="status" aria-label="Loading page">
      <div className="support-skeleton-hero">
        <span className="support-skeleton-pill" />
        <span className="support-skeleton-title" />
        <span className="support-skeleton-sub" />
        <span className="support-skeleton-search" />
      </div>
      <div className="support-skeleton-main">
        <div className="support-skeleton-block" />
        <div className="support-skeleton-grid">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="support-skeleton-card" />
          ))}
        </div>
      </div>
    </div>
  )
}
