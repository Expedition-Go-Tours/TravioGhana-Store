import { act, cleanup, render } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

/**
 * Connectivity toasts: losing connectivity shows a sticky red toast at the
 * bottom of the screen, and reconnecting turns it into a green "online" toast
 * that auto-dismisses. The whole react-hot-toast module is mocked so the test
 * asserts on the calls the component makes, not on the library's rendering.
 */

const state = vi.hoisted(() => ({
  error: vi.fn(),
  success: vi.fn(),
  toasterProps: null as Record<string, unknown> | null,
}))

vi.mock('react-hot-toast', () => ({
  Toaster: (props: Record<string, unknown>) => {
    state.toasterProps = props
    return null
  },
  toast: { error: state.error, success: state.success },
}))

import ConnectivityToaster from './ConnectivityToaster'

function setNavigatorOnline(value: boolean) {
  Object.defineProperty(navigator, 'onLine', { configurable: true, get: () => value })
}

function setOffline() {
  setNavigatorOnline(false)
  act(() => {
    window.dispatchEvent(new Event('offline'))
  })
}

function setOnline() {
  setNavigatorOnline(true)
  act(() => {
    window.dispatchEvent(new Event('online'))
  })
}

describe('ConnectivityToaster', () => {
  beforeEach(() => {
    state.error.mockClear()
    state.success.mockClear()
    state.toasterProps = null
    setNavigatorOnline(true)
  })

  afterEach(() => {
    cleanup()
    setNavigatorOnline(true)
  })

  it('stays silent when the app starts online', () => {
    render(<ConnectivityToaster />)

    expect(state.error).not.toHaveBeenCalled()
    expect(state.success).not.toHaveBeenCalled()
  })

  it('shows a sticky offline toast when connectivity is lost', () => {
    render(<ConnectivityToaster />)

    setOffline()

    expect(state.error).toHaveBeenCalledTimes(1)
    expect(state.error).toHaveBeenCalledWith('You are currently offline', {
      id: 'connectivity',
      duration: Infinity,
    })
  })

  it('turns the offline toast into an auto-dismissing online toast on reconnect', () => {
    render(<ConnectivityToaster />)

    setOffline()
    setOnline()

    expect(state.success).toHaveBeenCalledTimes(1)
    expect(state.success).toHaveBeenCalledWith('You are currently online', {
      id: 'connectivity',
      duration: 2500,
    })
  })

  it('shows the offline toast immediately when the page mounts offline', () => {
    setNavigatorOnline(false)

    render(<ConnectivityToaster />)

    expect(state.error).toHaveBeenCalledTimes(1)
    expect(state.error).toHaveBeenCalledWith('You are currently offline', {
      id: 'connectivity',
      duration: Infinity,
    })
  })

  it('never announces "online" without an offline in between', () => {
    render(<ConnectivityToaster />)

    setOnline()

    expect(state.success).not.toHaveBeenCalled()
  })

  it('mounts its own bottom-center toaster tinted with the semantic tokens', () => {
    render(<ConnectivityToaster />)

    const props = state.toasterProps
    expect(props?.position).toBe('bottom-center')

    const toastOptions = props?.toastOptions as {
      error: { style: Record<string, string> }
      success: { style: Record<string, string> }
    }
    expect(toastOptions.error.style.background).toContain('--bv-danger-bg')
    expect(toastOptions.error.style.color).toContain('--bv-danger-text')
    expect(toastOptions.success.style.background).toContain('--bv-success-bg')
    expect(toastOptions.success.style.color).toContain('--bv-success-text')
  })
})
