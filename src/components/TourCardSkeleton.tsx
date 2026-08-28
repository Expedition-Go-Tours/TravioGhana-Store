import './skeleton.css'

export default function TourCardSkeleton() {
  return (
    <div className="tour-card-skeleton">
      <div className="tour-card-skeleton-image">
        <div className="skeleton-shimmer" />
      </div>
      <div className="tour-card-skeleton-body">
        <div className="skeleton-line skeleton-line-category" />
        <div className="skeleton-line skeleton-line-title" />
        <div className="skeleton-line skeleton-line-title-short" />
        <div className="skeleton-line skeleton-line-features" />
        <div className="skeleton-row">
          <div className="skeleton-line skeleton-line-price" />
          <div className="skeleton-line skeleton-line-rating" />
        </div>
      </div>
    </div>
  )
}
