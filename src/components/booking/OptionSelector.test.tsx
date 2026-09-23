import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import OptionSelector from './OptionSelector'
import type { TourOption } from '../../lib/tourTypes'

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string, fallback?: string) => fallback ?? key }),
}))

const options: TourOption[] = [
  { id: 'a', title: 'Morning Tour', fromPrice: 50, currency: 'USD' },
  { id: 'b', title: 'Sunset Tour', description: 'Golden hour views', fromPrice: 80, currency: 'USD' },
  { id: 'c', title: 'Private Tour', isPrivate: true, fromPrice: 300, currency: 'USD' },
]

describe('OptionSelector', () => {
  it('renders one radio row per non-private option with price', () => {
    render(<OptionSelector options={options} value={null} onChange={() => {}} />)
    expect(screen.getByText('Morning Tour')).toBeTruthy()
    expect(screen.getByText('Sunset Tour')).toBeTruthy()
    expect(screen.queryByText('Private Tour')).toBeNull()
    expect(screen.getAllByText('from').length).toBe(2)
  })

  it('fires onChange with the clicked option id', () => {
    const onChange = vi.fn()
    render(<OptionSelector options={options} value={null} onChange={onChange} />)
    fireEvent.click(screen.getByText('Sunset Tour'))
    expect(onChange).toHaveBeenCalledWith('b')
  })

  it('marks the selected option and disables blocked ids', () => {
    const onChange = vi.fn()
    const disabled = new Set(['b'])
    render(<OptionSelector options={options} value="a" onChange={onChange} disabledIds={disabled} />)
    const selected = screen.getByText('Morning Tour').closest('button')
    expect(selected?.getAttribute('aria-checked')).toBe('true')

    const sunset = screen.getByText('Sunset Tour').closest('button')
    expect(sunset?.getAttribute('aria-disabled') ?? sunset?.hasAttribute('disabled')).toBeTruthy()
  })

  it('shows shimmer while loading and options are absent', () => {
    render(<OptionSelector options={[]} value={null} onChange={() => {}} loading />)
    expect(document.querySelectorAll('.osc-skeleton').length).toBe(2)
  })

  it('returns null when there are no visible options', () => {
    const { container } = render(<OptionSelector options={[]} value={null} onChange={() => {}} />)
    expect(container.querySelector('.osc')).toBeNull()
  })
})
