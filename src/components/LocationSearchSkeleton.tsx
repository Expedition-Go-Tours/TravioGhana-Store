import './LocationSearchSkeleton.css'

/**
 * Full-page skeleton shown while the personalized homepage is loading.
 * Matches the layout of the real homepage: hero placeholder + 5 skeleton
 * section rows with card placeholders.
 */
export default function LocationSearchSkeleton() {
  return (
    <div className="location-skeleton" aria-label="Loading homepage">
      <div className="location-skeleton-hero" />
      <div className="location-skeleton-sections">
        {[0, 1, 2, 3, 4].map((s) => (
          <div key={s} className="location-skeleton-section">
            <div className="location-skeleton-heading" />
            <div className="location-skeleton-cards">
              {[0, 1, 2, 3, 4].map((c) => (
                <div key={c} className="location-skeleton-card">
                  <div className="location-skeleton-card-img" />
                  <div className="location-skeleton-card-lines">
                    <div className="location-skeleton-line location-skeleton-line--long" />
                    <div className="location-skeleton-line location-skeleton-line--short" />
                    <div className="location-skeleton-line location-skeleton-line--medium" />
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
