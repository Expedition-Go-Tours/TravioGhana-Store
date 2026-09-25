import { describe, expect, it, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'
import LanguageCurrencyModal from './LanguageCurrencyModal'
import i18n from '../i18n/config'

const mocks = vi.hoisted(() => ({ setCurrency: vi.fn() }))

vi.mock('../contexts/CurrencyContext', () => ({
  useCurrency: () => ({ currency: { code: 'USD', symbol: '$' }, setCurrency: mocks.setCurrency }),
  availableCurrencies: [
    { code: 'USD', symbol: '$', label: 'US Dollar' },
    { code: 'GHS', symbol: '₵', label: 'Ghanaian Cedi' },
  ],
}))

/**
 * The picker is one centred dialog at every width. It used to become a bottom
 * sheet below 640px (`items-end`, rounded top corners, slide-up), so the footer
 * opened a drawer from the bottom on phones while the desktop globe opened a
 * centred modal.
 */
describe('LanguageCurrencyModal', () => {
  beforeEach(() => {
    cleanup()
    mocks.setCurrency.mockReset()
    document.body.style.overflow = ''
  })

  it('is a centred dialog, never a bottom sheet', () => {
    const { container } = render(<LanguageCurrencyModal onClose={() => {}} />)

    const overlay = container.firstElementChild as HTMLElement
    expect(overlay.className).toContain('items-center')
    expect(overlay.className).not.toContain('items-end')

    const dialog = screen.getByRole('dialog')
    expect(dialog.className).toContain('rounded-2xl')
    expect(dialog.className).not.toContain('rounded-t-2xl')
    expect(dialog).toHaveAttribute('aria-modal', 'true')
  })

  it('closes on Escape', () => {
    const onClose = vi.fn()
    render(<LanguageCurrencyModal onClose={onClose} />)

    fireEvent.keyDown(document, { key: 'Escape' })

    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('locks the page behind it and restores the previous overflow', () => {
    document.body.style.overflow = 'scroll'
    const { unmount } = render(<LanguageCurrencyModal onClose={() => {}} />)
    expect(document.body.style.overflow).toBe('hidden')

    unmount()
    expect(document.body.style.overflow).toBe('scroll')
  })

  it('returns focus to whatever was focused before it opened', () => {
    const trigger = document.createElement('button')
    document.body.appendChild(trigger)
    trigger.focus()

    const { unmount } = render(<LanguageCurrencyModal onClose={() => {}} />)
    expect(screen.getByRole('dialog')).toHaveFocus()

    unmount()
    expect(trigger).toHaveFocus()
    trigger.remove()
  })

  it('applies the chosen language and closes', () => {
    const onClose = vi.fn()
    const changeLanguage = vi.spyOn(i18n, 'changeLanguage').mockResolvedValue(undefined as never)
    render(<LanguageCurrencyModal onClose={onClose} initialTab="language" />)

    // real i18n is initialised in the test setup, so these are the English labels
    fireEvent.click(screen.getByText('Español'))

    expect(changeLanguage).toHaveBeenCalledWith('es')
    expect(onClose).toHaveBeenCalled()
    changeLanguage.mockRestore()
  })

  it('applies the chosen currency and closes', () => {
    const onClose = vi.fn()
    render(<LanguageCurrencyModal onClose={onClose} initialTab="currency" />)

    fireEvent.click(screen.getByText('GHS'))

    expect(mocks.setCurrency).toHaveBeenCalledWith('GHS')
    expect(onClose).toHaveBeenCalled()
  })

  it('switches between the language and currency tabs', () => {
    render(<LanguageCurrencyModal onClose={() => {}} />)

    // opens on language by default
    expect(screen.getByRole('dialog')).toHaveAttribute('aria-label', 'Language')
    expect(screen.getByText('English')).toBeInTheDocument()

    fireEvent.click(screen.getByText('Currency'))

    // The tab panel cross-fades (AnimatePresence mode="wait"), so assert the
    // synchronous signal here; the currency grid itself is covered by the
    // initialTab="currency" test above.
    expect(screen.getByRole('dialog')).toHaveAttribute('aria-label', 'Currency')
  })
})
