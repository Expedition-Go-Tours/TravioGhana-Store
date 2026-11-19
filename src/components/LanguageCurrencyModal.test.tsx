import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, cleanup, waitFor, within } from '@testing-library/react'
import LanguageCurrencyModal from './LanguageCurrencyModal'
import i18n from '../i18n/config'

const mocks = vi.hoisted(() => ({
  setCurrency: vi.fn(),
  lenis: { stop: vi.fn(), start: vi.fn() },
}))

vi.mock('../contexts/CurrencyContext', () => ({
  useCurrency: () => ({ currency: { code: 'USD', symbol: '$' }, setCurrency: mocks.setCurrency }),
  availableCurrencies: [
    { code: 'USD', symbol: '$', label: 'US Dollar' },
    { code: 'GHS', symbol: '₵', label: 'Ghanaian Cedi' },
  ],
}))

vi.mock('../lib/LenisProvider', () => ({
  getLenis: () => mocks.lenis,
}))

/**
 * The picker is one centred dialog at every width. Its language tab is a
 * native-name grid (no flags, no selected pill), and opening it must lock the
 * document and Lenis so the page underneath cannot scroll.
 */
describe('LanguageCurrencyModal', () => {
  beforeEach(() => {
    cleanup()
    mocks.setCurrency.mockReset()
    mocks.lenis.stop.mockReset()
    mocks.lenis.start.mockReset()
    document.documentElement.style.overflow = ''
    document.body.style.overflow = ''
    document.body.style.paddingRight = ''
  })

  afterEach(async () => {
    cleanup()
    vi.restoreAllMocks()
    await i18n.changeLanguage('en')
    document.documentElement.style.overflow = ''
    document.body.style.overflow = ''
    document.body.style.paddingRight = ''
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

  it('locks the root, body and Lenis, then restores them on unmount', () => {
    document.documentElement.style.overflow = 'scroll'
    document.body.style.overflow = 'scroll'
    document.body.style.paddingRight = '4px'

    const { unmount } = render(<LanguageCurrencyModal onClose={() => {}} />)

    expect(mocks.lenis.stop).toHaveBeenCalledTimes(1)
    expect(document.documentElement.style.overflow).toBe('hidden')
    expect(document.body.style.overflow).toBe('hidden')

    unmount()

    expect(mocks.lenis.start).toHaveBeenCalledTimes(1)
    expect(document.documentElement.style.overflow).toBe('scroll')
    expect(document.body.style.overflow).toBe('scroll')
    expect(document.body.style.paddingRight).toBe('4px')
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

  it('renders the language grid without flags and with a responsive column layout', () => {
    render(<LanguageCurrencyModal onClose={() => {}} />)

    const grid = screen.getByTestId('language-grid')
    expect(grid.className).toContain('grid-cols-1')
    expect(grid.className).toContain('sm:grid-cols-2')
    expect(grid.className).toContain('lg:grid-cols-3')

    expect(screen.queryByText('🇪🇸')).not.toBeInTheDocument()
    expect(screen.queryByText('🇬🇧')).not.toBeInTheDocument()
  })

  it('puts the current language first and marks it selected', () => {
    render(<LanguageCurrencyModal onClose={() => {}} />)

    const grid = screen.getByTestId('language-grid')
    const buttons = within(grid).getAllByRole('button')
    expect(buttons[0]).toHaveTextContent('English (United States)')
    expect(buttons[0]).toHaveAttribute('aria-pressed', 'true')
  })

  it('marks the language list as an independent Lenis scroll area', () => {
    render(<LanguageCurrencyModal onClose={() => {}} />)

    const scroll = document.querySelector('[data-lenis-prevent]')
    expect(scroll).not.toBeNull()
    expect(scroll?.className).toContain('overscroll-contain')
    expect(scroll?.className).toContain('overflow-x-hidden')
  })

  it('applies the chosen language and closes', () => {
    const onClose = vi.fn()
    const changeLanguage = vi.spyOn(i18n, 'changeLanguage').mockResolvedValue(undefined as never)
    render(<LanguageCurrencyModal onClose={onClose} initialTab="language" />)

    fireEvent.click(screen.getByText('Español (España)'))

    expect(changeLanguage).toHaveBeenCalledWith('es')
    expect(onClose).toHaveBeenCalled()
    changeLanguage.mockRestore()
  })

  it('passes the exact regional code, not the base language', () => {
    const onClose = vi.fn()
    const changeLanguage = vi.spyOn(i18n, 'changeLanguage').mockResolvedValue(undefined as never)
    render(<LanguageCurrencyModal onClose={onClose} initialTab="language" />)

    fireEvent.click(screen.getByText('Deutsch (Österreich)'))

    expect(changeLanguage).toHaveBeenCalledWith('de-AT')
    expect(onClose).toHaveBeenCalled()
    changeLanguage.mockRestore()
  })

  it('renders every language from the reference list', () => {
    render(<LanguageCurrencyModal onClose={() => {}} />)

    for (const label of [
      'Català',
      'Deutsch (Schweiz)',
      'English (Australia)',
      'Español (México)',
      '日本語',
      '繁體中文（香港）',
      '繁體中文（台灣）',
    ]) {
      expect(screen.getByText(label)).toBeInTheDocument()
    }
  })

  it('switches language and back without breaking i18n', async () => {
    render(<LanguageCurrencyModal onClose={() => {}} />)

    fireEvent.click(screen.getByText('Deutsch (Deutschland)'))
    await waitFor(() => expect(i18n.language).toBe('de'), { timeout: 3000 })
    await waitFor(() => expect(i18n.t('nav.language')).toBe('Sprache'), { timeout: 3000 })

    fireEvent.click(screen.getByText('English (United States)'))
    await waitFor(() => expect(i18n.language).toBe('en'), { timeout: 3000 })
    expect(i18n.t('nav.language')).toBe('Language')
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
    expect(screen.getByText('English (United States)')).toBeInTheDocument()

    fireEvent.click(screen.getByText('Currency'))

    // The tab panel cross-fades (AnimatePresence mode="wait"), so assert the
    // synchronous signal here; the currency grid itself is covered by the
    // initialTab="currency" test above.
    expect(screen.getByRole('dialog')).toHaveAttribute('aria-label', 'Currency')
  })
})
