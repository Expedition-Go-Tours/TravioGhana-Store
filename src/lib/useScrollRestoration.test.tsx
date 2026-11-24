import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import { MemoryRouter, useLocation, useNavigate } from 'react-router-dom'
import { readSavedScroll, useScrollRestoration, writeSavedScroll } from './useScrollRestoration'

vi.mock('./scrollToTop', () => ({
  scrollToTop: vi.fn(() => {
    // Stand-in for the real jump: the reader is now at the top of the new page.
    Object.defineProperty(window, 'scrollY', { value: 0, configurable: true, writable: true })
  }),
  scrollToPosition: vi.fn(),
}))

import { scrollToPosition, scrollToTop } from './scrollToTop'

const mockScrollToTop = vi.mocked(scrollToTop)
const mockScrollToPosition = vi.mocked(scrollToPosition)

function Probe() {
  const location = useLocation()
  const navigate = useNavigate()
  useScrollRestoration()
  return (
    <div>
      <span data-testid="path">{location.pathname}</span>
      <span data-testid="key">{location.key}</span>
      <button type="button" onClick={() => navigate('/next')}>
        next
      </button>
      <button type="button" onClick={() => navigate(location.pathname + location.search)}>
        self
      </button>
      <button type="button" onClick={() => navigate(-1)}>
        back
      </button>
    </div>
  )
}

function renderAt(entries: string[], initialIndex = 0) {
  return render(
    <MemoryRouter initialEntries={entries} initialIndex={initialIndex}>
      <Probe />
    </MemoryRouter>,
  )
}

function setScrollY(value: number) {
  Object.defineProperty(window, 'scrollY', { value, configurable: true, writable: true })
}

function setPageHeight(scrollHeight: number, innerHeight = 800) {
  Object.defineProperty(document.documentElement, 'scrollHeight', {
    value: scrollHeight,
    configurable: true,
  })
  Object.defineProperty(window, 'innerHeight', { value: innerHeight, configurable: true })
}

/** A scroll with real input behind it: wheel, then the resulting scroll event. */
function readerScrollsTo(value: number) {
  fireEvent.wheel(window)
  setScrollY(value)
  fireEvent.scroll(window)
}

describe('useScrollRestoration', () => {
  beforeEach(() => {
    window.sessionStorage.clear()
    mockScrollToTop.mockReset()
    mockScrollToPosition.mockReset()
    setScrollY(0)
    setPageHeight(6000)
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('remembers the offset of the entry the reader is on', async () => {
    renderAt(['/a'])
    const key = screen.getByTestId('key').textContent as string

    readerScrollsTo(1840)

    await waitFor(() => expect(readSavedScroll(key)).toBe(1840))
  })

  it('returns the reader to that offset on Back', async () => {
    renderAt(['/a', '/next'])
    const keyA = screen.getByTestId('key').textContent as string

    readerScrollsTo(1840)
    await waitFor(() => expect(readSavedScroll(keyA)).toBe(1840))

    fireEvent.click(screen.getByText('next'))
    await waitFor(() => expect(screen.getByTestId('path').textContent).toBe('/next'))

    fireEvent.click(screen.getByText('back'))
    await waitFor(() => expect(screen.getByTestId('path').textContent).toBe('/a'))

    await waitFor(() => expect(mockScrollToPosition).toHaveBeenCalledWith(1840))
  })

  it('keeps scrolling at the ceiling until lazy content makes the page tall', async () => {
    renderAt(['/a'])
    const keyA = screen.getByTestId('key').textContent as string
    writeSavedScroll(keyA, 1840)

    fireEvent.click(screen.getByText('next'))
    await waitFor(() => expect(screen.getByTestId('path').textContent).toBe('/next'))
    setPageHeight(1000)

    fireEvent.click(screen.getByText('back'))

    await waitFor(() => expect(mockScrollToPosition).toHaveBeenCalledWith(200))
    // Page grows as the first scroll mounts more sections; the loop follows.
    setPageHeight(6000)
    await waitFor(() => expect(mockScrollToPosition).toHaveBeenCalledWith(1840))
    expect(readSavedScroll(keyA)).toBe(1840)
  })

  it('lands at the top when following a link', async () => {
    renderAt(['/a', '/next'])
    fireEvent.click(screen.getByText('next'))

    await waitFor(() => expect(screen.getByTestId('path').textContent).toBe('/next'))
    expect(mockScrollToTop).toHaveBeenCalled()
    expect(mockScrollToPosition).not.toHaveBeenCalled()
  })

  it('does not scroll at all when there is nothing remembered', async () => {
    renderAt(['/a', '/next'], 1)
    // A fresh entry (opened directly) has no saved offset: land at the top.
    await waitFor(() => expect(mockScrollToTop).toHaveBeenCalled())
  })

  it('restores after a same-URL link, like the footer Home link', async () => {
    renderAt(['/a'])
    const keyA = screen.getByTestId('key').textContent as string

    readerScrollsTo(1840)
    await waitFor(() => expect(readSavedScroll(keyA)).toBe(1840))

    fireEvent.click(screen.getByText('self'))
    await waitFor(() => expect(screen.getByTestId('key').textContent).not.toBe(keyA))
    fireEvent.click(screen.getByText('back'))
    await waitFor(() => expect(screen.getByTestId('key').textContent).toBe(keyA))

    await waitFor(() => expect(mockScrollToPosition).toHaveBeenCalledWith(1840))
  })

  it('ignores the horizontal wheel tail of a trackpad swipe-back', async () => {
    renderAt(['/a', '/next'])
    const keyA = screen.getByTestId('key').textContent as string

    readerScrollsTo(1840)
    await waitFor(() => expect(readSavedScroll(keyA)).toBe(1840))

    fireEvent.click(screen.getByText('next'))
    await waitFor(() => expect(screen.getByTestId('path').textContent).toBe('/next'))
    fireEvent.click(screen.getByText('back'))
    await waitFor(() => expect(screen.getByTestId('path').textContent).toBe('/a'))
    fireEvent.wheel(window, { deltaX: 160, deltaY: 0 })

    await waitFor(() => expect(mockScrollToPosition).toHaveBeenCalledWith(1840))
  })

  it('does not restore a stale offset on a fresh page load', async () => {
    // A reload or a pasted link reuses the `default` key. React Router calls
    // that POP, but nobody returned to an entry they had left.
    writeSavedScroll('default', 1840)
    renderAt(['/a'])

    await waitFor(() => expect(mockScrollToTop).toHaveBeenCalled())
    expect(mockScrollToPosition).not.toHaveBeenCalled()
  })

  it('ignores a remembered position of zero', () => {
    expect(readSavedScroll('nothing-here')).toBeNull()
    writeSavedScroll('at-top', 0)
    expect(readSavedScroll('at-top')).toBeNull()
  })

  it('does not let a route-swap clamp overwrite the real offset', async () => {
    renderAt(['/a', '/next'])
    const keyA = screen.getByTestId('key').textContent as string

    readerScrollsTo(1840)
    await waitFor(() => expect(readSavedScroll(keyA)).toBe(1840))

    // The browser's own jump when we return, or a re-layout with no user
    // input, must not be mistaken for the reader moving.
    setScrollY(0)
    fireEvent.scroll(window)
    await waitFor(() => expect(readSavedScroll(keyA)).toBe(1840))
  })

  it('ignores programmatic scrolls even while Lenis is gliding', async () => {
    renderAt(['/a'])
    const key = screen.getByTestId('key').textContent as string

    fireEvent.wheel(window)
    readerScrollsTo(1840)
    await waitFor(() => expect(readSavedScroll(key)).toBe(1840))

    // Lenis keeps emitting scroll events for its momentum; none of them have
    // a fresh input event behind them, and the page is now shorter.
    setPageHeight(2000)
    setScrollY(0)
    fireEvent.scroll(window)
    await waitFor(() => expect(readSavedScroll(key)).toBe(1840))
  })

  it('forgets the offset when the reader deliberately returns to the top', async () => {
    renderAt(['/a'])
    const key = screen.getByTestId('key').textContent as string

    readerScrollsTo(1840)
    await waitFor(() => expect(readSavedScroll(key)).toBe(1840))

    readerScrollsTo(0)
    await waitFor(() => expect(readSavedScroll(key)).toBeNull(), { timeout: 1500 })
  })
})
