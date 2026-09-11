import './HomeSectionSkeleton.css'

/**
 * Suspense fallback for the lazy below-fold homepage sections. Shown only
 * while a section's JS chunk loads — mirrors the real carousel layout so the
 * page never shows a blank gap.
 */
export default function HomeSectionSkeleton() {
  return (
    <section className="home-section-skeleton" aria-hidden="true">
      <div className="home-section-skeleton-heading" />
      <div className="home-section-skeleton-cards">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="home-section-skeleton-card">
            <div className="home-section-skeleton-img" />
            <div className="home-section-skeleton-lines">
              <div className="home-section-skeleton-line home-section-skeleton-line--long" />
              <div className="home-section-skeleton-line home-section-skeleton-line--short" />
              <div className="home-section-skeleton-line home-section-skeleton-line--medium" />
            </div>
          </div>
        ))}
      </div>
    </section>
  )
}
