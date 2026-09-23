import './LocationSearchSkeleton.css'

interface Props {
  /** The city being searched — shown in the status line. */
  location?: string | null
}

/**
 * Location-search loader shown while the personalized homepage data loads.
 * The real hero stays visible above it (no gray placeholder), so the page
 * paints instantly; below sits a spinner + status line and shimmer rows,
 * matching the prototype's skeleton(loc).
 */
export default function LocationSearchSkeleton({ location }: Props) {
  return (
    <div className="location-loader" role="status" aria-live="polite">
      <div className="location-loader-status">
        <span className="location-loader-spinner" aria-hidden="true" />
        <span>
          Finding the best experiences{location ? ` in ${location}` : ''}...
        </span>
      </div>
      <div className="location-skeleton-sections">
        {[0, 1, 2, 3, 4].map((s) => (
          <div key={s} className="location-skeleton-section">
            <div className="location-skeleton-section-inner">
              <div className="location-skeleton-viewport">
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
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
