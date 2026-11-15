import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { buildAboutContent } from './DetailsSection'

/**
 * Operators write tour descriptions in paragraphs separated by blank lines.
 * The About block must keep those breaks instead of collapsing the whole
 * description into one wall of text.
 */
describe('buildAboutContent', () => {
  it('renders one paragraph per blank-line separated block', () => {
    const { container } = render(
      <>{buildAboutContent('First paragraph here.\n\nSecond paragraph here.\n\nThird one.')}</>,
    )

    const paragraphs = container.querySelectorAll('p.details-text')
    expect(paragraphs).toHaveLength(3)
    expect(paragraphs[0]).toHaveTextContent('First paragraph here.')
    expect(paragraphs[2]).toHaveTextContent('Third one.')
  })

  it('joins soft-wrapped lines inside a paragraph', () => {
    const { container } = render(<>{buildAboutContent('A line wraps\nonto the next line.')}</>)

    const paragraphs = container.querySelectorAll('p.details-text')
    expect(paragraphs).toHaveLength(1)
    expect(paragraphs[0].textContent).toBe('A line wraps onto the next line.')
  })

  it('still turns numbered lines into a list', () => {
    render(<>{buildAboutContent('Intro text.\n\n1. First stop\n2. Second stop')}</>)

    expect(screen.getByText('Intro text.')).toBeInTheDocument()
    expect(screen.getByText('First stop')).toBeInTheDocument()
    expect(screen.getByText('Second stop')).toBeInTheDocument()
  })

  it('shows the fallback when there is no description', () => {
    render(<>{buildAboutContent('')}</>)
    expect(screen.getByText(/coming soon/i)).toBeInTheDocument()
  })
})
