import './PaginationDots.css'

interface PaginationDotsProps {
  total: number
  active: number
  onDotClick: (index: number) => void
}

export default function PaginationDots({ total, active, onDotClick }: PaginationDotsProps) {
  return (
    <div className="pagination-dots">
      {Array.from({ length: total }, (_, i) => (
        <button
          key={i}
          className={`dot${i === active ? ' active' : ''}`}
          onClick={() => onDotClick(i)}
          aria-label={`Go to slide ${i + 1}`}
        />
      ))}
    </div>
  )
}
