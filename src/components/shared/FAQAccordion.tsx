import { useState, useRef, useEffect, useCallback } from 'react'

interface FAQItem {
  question: string
  answer: string
}

interface FAQAccordionProps {
  items: FAQItem[]
  /** First item starts open (default true). */
  defaultOpen?: boolean
  /**
   * Render "01", "02"… before each question (the supplier landing template).
   * Off by default so the partner pages keep their plain questions.
   */
  numbered?: boolean
}

/**
 * Accessible FAQ accordion matching the HTML template's `.faq-item` /
 * `.faq-q` / `.faq-a` pattern.  Pure React — no animation library needed.
 *
 * Answer heights come from a ResizeObserver rather than being read during
 * render: `answerRefs.current[i]` is only populated on commit, so a render-phase
 * read saw `null` on the first pass and never recovered — leaving answers longer
 * than the CSS `max-height: 200px` cap permanently clipped. Measuring in the
 * observer also keeps the expanded height correct when the copy reflows
 * (viewport resize, font swap, locale change).
 */
export default function FAQAccordion({ items, defaultOpen = true, numbered = false }: FAQAccordionProps) {
  const [openIndex, setOpenIndex] = useState<number | null>(defaultOpen ? 0 : null)
  const [heights, setHeights] = useState<Record<number, number>>({})
  const answerRefs = useRef<(HTMLDivElement | null)[]>([])

  useEffect(() => {
    if (typeof ResizeObserver === 'undefined') return

    const measure = () => {
      setHeights((prev) => {
        let changed = false
        const next: Record<number, number> = {}
        answerRefs.current.forEach((el, i) => {
          if (!el) return
          const height = el.scrollHeight
          next[i] = height
          if (prev[i] !== height) changed = true
        })
        return changed ? next : prev
      })
    }

    const observer = new ResizeObserver(measure)
    answerRefs.current.forEach((el) => el && observer.observe(el))
    measure()
    return () => observer.disconnect()
  }, [items])

  const toggle = useCallback((index: number) => {
    setOpenIndex((prev) => (prev === index ? null : index))
  }, [])

  return (
    <div className="eg-faq">
      {items.map((item, i) => {
        const isOpen = openIndex === i
        const height = heights[i]
        return (
          <div key={i} className={`eg-faq-item${isOpen ? ' eg-open' : ''}`}>
            <button
              type="button"
              className="eg-faq-btn"
              onClick={() => toggle(i)}
              aria-expanded={isOpen}
            >
              <span>
                {numbered && <b aria-hidden="true">{String(i + 1).padStart(2, '0')}</b>}
                {item.question}
              </span>
              <span aria-hidden="true">+</span>
            </button>
            <div
              className="eg-faq-answer"
              ref={(el) => { answerRefs.current[i] = el }}
              style={isOpen && height ? { maxHeight: `${height}px` } : undefined}
            >
              <p>{item.answer}</p>
            </div>
          </div>
        )
      })}
    </div>
  )
}
