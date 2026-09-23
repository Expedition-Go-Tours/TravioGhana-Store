import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { AnimatePresence, motion } from 'framer-motion'
import { Search } from 'lucide-react'
import { getAllFaqs } from '../../lib/faq'

interface SupportSearchProps {
  className?: string
  /** Router state forwarded on result selection (e.g. the Help Centre origin). */
  linkState?: unknown
}

/** Search over every FAQ answer; selecting a result deep-links into /faq. */
export default function SupportSearch({ className, linkState }: SupportSearchProps) {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)
  const [highlighted, setHighlighted] = useState(-1)
  const rootRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const results = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (q.length < 2) return []
    return getAllFaqs(t)
      .filter(
        (entry) =>
          entry.q.toLowerCase().includes(q) ||
          entry.a.toLowerCase().includes(q) ||
          entry.category.toLowerCase().includes(q),
      )
      .slice(0, 6)
  }, [query, t])

  useEffect(() => {
    const onPointerDown = (event: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', onPointerDown)
    return () => document.removeEventListener('mousedown', onPointerDown)
  }, [])

  const goTo = (id: string) => {
    setOpen(false)
    setHighlighted(-1)
    inputRef.current?.blur()
    navigate(`/faq#faq-${id}`, linkState ? { state: linkState } : undefined)
  }

  const submit = () => {
    const target = highlighted >= 0 ? results[highlighted] : results[0]
    if (target) goTo(target.id)
  }

  const showDropdown = open && query.trim().length >= 2

  return (
    <div className={`sh-search${className ? ` ${className}` : ''}`} ref={rootRef}>
      <form
        className="sh-search-form"
        role="search"
        onSubmit={(event) => {
          event.preventDefault()
          submit()
        }}
      >
        <Search size={18} className="sh-search-icon" aria-hidden="true" />
        <input
          ref={inputRef}
          type="search"
          className="sh-search-input"
          placeholder={t('supportHub.searchPlaceholder')}
          aria-label={t('supportHub.searchPlaceholder')}
          autoComplete="off"
          value={query}
          role="combobox"
          aria-expanded={showDropdown}
          aria-controls="sh-search-results"
          aria-autocomplete="list"
          onChange={(event) => {
            const value = event.target.value
            setQuery(value)
            setHighlighted(-1)
            setOpen(value.trim().length >= 2)
          }}
          onFocus={() => {
            if (query.trim().length >= 2) setOpen(true)
          }}
          onKeyDown={(event) => {
            if (event.key === 'ArrowDown') {
              event.preventDefault()
              setOpen(true)
              setHighlighted((prev) => (prev < results.length - 1 ? prev + 1 : 0))
            } else if (event.key === 'ArrowUp') {
              event.preventDefault()
              setHighlighted((prev) => (prev > 0 ? prev - 1 : results.length - 1))
            } else if (event.key === 'Escape') {
              setOpen(false)
              setHighlighted(-1)
            }
          }}
        />
        <button type="submit" className="sh-search-btn">
          {t('hero.search')}
        </button>
      </form>

      <AnimatePresence>
        {showDropdown && (
          <motion.div
            className="sh-search-dropdown"
            id="sh-search-results"
            role="listbox"
            initial={{ opacity: 0, y: -6, scale: 0.99 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.16, ease: 'easeOut' }}
          >
            {results.length === 0 ? (
              <p className="sh-search-empty">
                {t('supportHub.searchNoResults', { query: query.trim() })}
              </p>
            ) : (
              results.map((result, index) => (
                <button
                  key={result.id}
                  type="button"
                  role="option"
                  aria-selected={index === highlighted}
                  className={`sh-search-result${index === highlighted ? ' active' : ''}`}
                  onMouseDown={(event) => {
                    event.preventDefault()
                    goTo(result.id)
                  }}
                  onMouseEnter={() => setHighlighted(index)}
                >
                  <span className="sh-search-result-cat">{result.category}</span>
                  <span className="sh-search-result-q">{result.q}</span>
                </button>
              ))
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
