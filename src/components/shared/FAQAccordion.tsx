import { useState, useRef, useCallback } from 'react'

interface FAQItem {
  question: string
  answer: string
}

interface FAQAccordionProps {
  items: FAQItem[]
  /** First item starts open (default true). */
  defaultOpen?: boolean
}

/**
 * Accessible FAQ accordion matching the HTML template's `.faq-item` /
 * `.faq-q` / `.faq-a` pattern.  Pure React — no animation library needed.
 */
export default function FAQAccordion({ items, defaultOpen = true }: FAQAccordionProps) {
  const [openIndex, setOpenIndex] = useState<number | null>(defaultOpen ? 0 : null)
  const answerRefs = useRef<(HTMLDivElement | null)[]>([])

  const toggle = useCallback((index: number) => {
    setOpenIndex((prev) => (prev === index ? null : index))
  }, [])

  return (
    <div className="eg-faq">
      {items.map((item, i) => {
        const isOpen = openIndex === i
        return (
          <div key={i} className={`eg-faq-item${isOpen ? ' eg-open' : ''}`}>
            <button
              type="button"
              className="eg-faq-btn"
              onClick={() => toggle(i)}
              aria-expanded={isOpen}
            >
              <span>{item.question}</span>
              <span aria-hidden="true">+</span>
            </button>
            <div
              className="eg-faq-answer"
              ref={(el) => { answerRefs.current[i] = el }}
              style={isOpen && answerRefs.current[i] ? { maxHeight: answerRefs.current[i]!.scrollHeight + 'px' } : undefined}
            >
              <p>{item.answer}</p>
            </div>
          </div>
        )
      })}
    </div>
  )
}