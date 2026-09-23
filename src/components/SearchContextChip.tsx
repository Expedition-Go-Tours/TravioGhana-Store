import { motion, AnimatePresence } from 'framer-motion'
import { useNavigate } from 'react-router-dom'
import type { SearchSuggestion } from '../hooks/useSearchAutocomplete'
import './SearchContextChip.css'

interface SearchContextChipProps {
  suggestion: SearchSuggestion | null
  onDismiss?: () => void
}

export default function SearchContextChip({ suggestion, onDismiss }: SearchContextChipProps) {
  const navigate = useNavigate()

  const handleClick = () => {
    if (!suggestion) return
    if (suggestion.kind === 'attraction') {
      navigate(`/tours?attraction=${encodeURIComponent(suggestion.name)}&place=${encodeURIComponent(suggestion.region || '')}`)
    } else if (suggestion.kind === 'place') {
      navigate(`/tours?place=${encodeURIComponent(suggestion.name)}`)
    } else if (suggestion.kind === 'region') {
      navigate(`/tours?place=${encodeURIComponent(suggestion.name)}`)
    } else if (suggestion.kind === 'tour' && suggestion.slug) {
      navigate(`/tour/${suggestion.slug}`)
    } else {
      navigate(`/tours?place=${encodeURIComponent(suggestion.name)}`)
    }
  }

  return (
    <AnimatePresence mode="wait">
      {suggestion && (
        <motion.div
          key={suggestion.name}
          className="search-context-chip"
          initial={{ opacity: 0, y: -6, height: 0, marginTop: 0 }}
          animate={{ opacity: 1, y: 0, height: 'auto', marginTop: 10 }}
          exit={{ opacity: 0, y: -6, height: 0, marginTop: 0 }}
          transition={{ duration: 0.22, ease: 'easeOut' }}
        >
          <button
            type="button"
            className="search-context-chip-btn"
            onClick={handleClick}
            aria-label={`View results for ${suggestion.name}`}
          >
            <span className="search-context-chip-text">
              Recommendations based on your search: <strong>{suggestion.name}</strong>
            </span>
            <span className="search-context-chip-arrow">
              View results ›
            </span>
          </button>
          {onDismiss && (
            <button
              type="button"
              className="search-context-chip-dismiss"
              onClick={(e) => {
                e.stopPropagation()
                onDismiss()
              }}
              aria-label="Dismiss"
            >
              ×
            </button>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  )
}
