import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, screen, fireEvent, act } from '@testing-library/react'
import FAQAccordion from './FAQAccordion'

/**
 * Regression tests for the expanded-height bug: the panel used to read
 * `answerRefs.current[i].scrollHeight` *during render*, which is null on the
 * first pass, so an answer taller than the stylesheet's `max-height: 200px`
 * stayed clipped forever. Heights now come from a ResizeObserver.
 */

const ANSWER_HEIGHT = 640

class MockResizeObserver {
  static instances: MockResizeObserver[] = []
  callback: ResizeObserverCallback
  constructor(callback: ResizeObserverCallback) {
    this.callback = callback
    MockResizeObserver.instances.push(this)
  }
  observe() {}
  unobserve() {}
  disconnect() {}
  /** Test helper: fire the observation the browser would deliver on layout. */
  trigger() {
    this.callback([], this as unknown as ResizeObserver)
  }
}

const items = [
  { question: 'How do I book?', answer: 'Pick a date, choose travellers and pay online.' },
  { question: 'Can I cancel?', answer: 'Free cancellation up to 24 hours before the tour starts.' },
]

describe('FAQAccordion', () => {
  beforeEach(() => {
    MockResizeObserver.instances = []
    vi.stubGlobal('ResizeObserver', MockResizeObserver)
    // jsdom has no layout engine, so scrollHeight is always 0.
    Object.defineProperty(HTMLElement.prototype, 'scrollHeight', {
      configurable: true,
      get() { return ANSWER_HEIGHT },
    })
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    delete (HTMLElement.prototype as any).scrollHeight
  })

  it('expands the open answer past the stylesheet max-height cap', () => {
    render(<FAQAccordion items={items} />)
    const panel = document.querySelectorAll('.eg-faq-answer')[0] as HTMLElement

    // height arrives from the observer, not from a render-phase ref read
    act(() => { MockResizeObserver.instances.forEach((o) => o.trigger()) })

    expect(panel.style.maxHeight).toBe(`${ANSWER_HEIGHT}px`)
  })

  it('starts with the first item open and toggles on click', () => {
    render(<FAQAccordion items={items} />)
    const buttons = screen.getAllByRole('button')

    expect(buttons[0]).toHaveAttribute('aria-expanded', 'true')
    expect(buttons[1]).toHaveAttribute('aria-expanded', 'false')

    fireEvent.click(buttons[1])
    expect(buttons[1]).toHaveAttribute('aria-expanded', 'true')
    expect(buttons[0]).toHaveAttribute('aria-expanded', 'false')

    fireEvent.click(buttons[1])
    expect(buttons[1]).toHaveAttribute('aria-expanded', 'false')
  })

  it('leaves the inline height off closed panels so the CSS transition runs', () => {
    render(<FAQAccordion items={items} />)
    act(() => { MockResizeObserver.instances.forEach((o) => o.trigger()) })

    const panels = document.querySelectorAll('.eg-faq-answer')
    expect((panels[1] as HTMLElement).style.maxHeight).toBe('')
  })

  it('respects defaultOpen={false}', () => {
    render(<FAQAccordion items={items} defaultOpen={false} />)
    screen.getAllByRole('button').forEach((b) => expect(b).toHaveAttribute('aria-expanded', 'false'))
  })

  it('renders zero-padded step numbers when numbered', () => {
    render(<FAQAccordion items={items} numbered />)

    const numbers = Array.from(document.querySelectorAll('.eg-faq-btn b')).map((el) => el.textContent)
    expect(numbers).toEqual(['01', '02'])
    expect(screen.getByText(/How do I book\?/)).toBeInTheDocument()
  })

  it('omits the numbers by default (partner pages keep plain questions)', () => {
    render(<FAQAccordion items={items} />)

    expect(document.querySelectorAll('.eg-faq-btn b')).toHaveLength(0)
  })
})
