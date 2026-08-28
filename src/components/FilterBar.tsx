import './FilterBar.css'

interface FilterBarProps {
  label: string
  options: { value: string; label: string }[]
  selected: string[]
  onChange: (value: string) => void
  multi?: boolean
}

export default function FilterBar({ label, options, selected, onChange }: FilterBarProps) {
  if (options.length === 0) return null

  return (
    <div className="filter-bar">
      <span className="filter-bar-label">{label}</span>
      <div className="filter-bar-pills">
        {options.map((opt) => {
          const isActive = selected.includes(opt.value)
          return (
            <button
              key={opt.value}
              className={`filter-pill${isActive ? ' active' : ''}`}
              onClick={() => onChange(opt.value)}
            >
              {opt.label}
            </button>
          )
        })}
      </div>
    </div>
  )
}
