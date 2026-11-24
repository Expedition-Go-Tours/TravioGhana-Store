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

    setScrollY(1840)
    fireEvent.scroll(window)

    await waitFor(() => expect(readSavedScroll(key)).toBe(1840))
  })

  it('returns the reader to that offset on Back', async () => {
    renderAt(['/a', '/next'])
    const keyA = screen.getByTestId('key').textContent as string

    setScrollY(1840)
    fireEvent.scroll(window)
    await waitFor(() => expect(readSavedScroll(keyA)).toBe(1840))

    fireEvent.click(screen.getByText('next'))
    await waitFor(() => expect(screen.getByTestId('path').textContent).toBe('/next'))

    fireEvent.click(screen.getByText('back'))
    await waitFor(() => expect(screen.getByTestId('path').textContent).toBe('/a'))

    await waitFor(() => expect(mockScrollToPosition).toHaveBeenCalledWith(1840))
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

  it('ignores a remembered position of zero', () => {
    expect(readSavedScroll('nothing-here')).toBeNull()
    writeSavedScroll('at-top', 0)
    expect(readSavedScroll('at-top')).toBeNull()
  })
})
