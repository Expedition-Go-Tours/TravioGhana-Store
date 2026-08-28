import './skeleton.css'

export default function CategorySkeleton() {
  return (
    <div className="category-skeleton">
      <div className="category-skeleton-image">
        <div className="skeleton-shimmer" />
      </div>
      <div className="skeleton-line category-skeleton-text" />
    </div>
  )
}
