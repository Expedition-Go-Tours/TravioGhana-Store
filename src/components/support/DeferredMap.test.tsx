import { describe, it, expect, afterEach } from 'vitest'
import { render, act } from '@testing-library/react'
import DeferredMap from './DeferredMap'

class MockIntersectionObserver {
  static instances: MockIntersectionObserver[] = []
  callback: IntersectionObserverCallback

  constructor(callback: IntersectionObserverCallback) {
    this.callback = callback
    MockIntersectionObserver.instances.push(this)
  }

  observe() {}
  unobserve() {}
  disconnect() {}
  takeRecords(): IntersectionObserverEntry[] {
    return []
  }

  root = null
  rootMargin = ''
  thresholds = []
}

const originalObserver = globalThis.IntersectionObserver

afterEach(() => {
  MockIntersectionObserver.instances = []
  if (originalObserver) {
    globalThis.IntersectionObserver = originalObserver
  } else {
    delete (globalThis as { IntersectionObserver?: unknown }).IntersectionObserver
  }
})

describe('DeferredMap', () => {
  it('shows the skeleton and only mounts the iframe once it enters the viewport', () => {
    globalThis.IntersectionObserver =
      MockIntersectionObserver as unknown as typeof IntersectionObserver

    const { container } = render(
      <DeferredMap title="Office map" src="https://example.com/map" />,
    )

    expect(container.querySelector('iframe')).toBeNull()
    expect(container.querySelector('.sh-map-skeleton')).not.toBeNull()

    act(() => {
      MockIntersectionObserver.instances[0].callback(
        [{ isIntersecting: true } as IntersectionObserverEntry],
        MockIntersectionObserver.instances[0] as unknown as IntersectionObserver,
      )
    })

    const iframe = container.querySelector('iframe')
    expect(iframe).not.toBeNull()
    expect(iframe?.getAttribute('title')).toBe('Office map')
    expect(iframe?.getAttribute('src')).toBe('https://example.com/map')
    expect(container.querySelector('.sh-map-skeleton')).toBeNull()
  })

  it('keeps the skeleton when the map is still off-screen', () => {
    globalThis.IntersectionObserver =
      MockIntersectionObserver as unknown as typeof IntersectionObserver

    const { container } = render(
      <DeferredMap title="Office map" src="https://example.com/map" />,
    )

    act(() => {
      MockIntersectionObserver.instances[0].callback(
        [{ isIntersecting: false } as IntersectionObserverEntry],
        MockIntersectionObserver.instances[0] as unknown as IntersectionObserver,
      )
    })

    expect(container.querySelector('iframe')).toBeNull()
    expect(container.querySelector('.sh-map-skeleton')).not.toBeNull()
  })

  it('renders the map immediately when IntersectionObserver is unavailable', () => {
    delete (globalThis as { IntersectionObserver?: unknown }).IntersectionObserver

    const { container } = render(
      <DeferredMap title="Office map" src="https://example.com/map" />,
    )

    expect(container.querySelector('iframe')).not.toBeNull()
  })
})
