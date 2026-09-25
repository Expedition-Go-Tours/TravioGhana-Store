import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, cleanup, waitFor } from '@testing-library/react'
import TourImageGallery from './TourImageGallery'

const IMAGES = Array.from(
  { length: 5 },
  (_, i) => `https://res.cloudinary.com/demo/image/upload/v1/tour/photo-${i}.jpg`,
)

/** jsdom has no layout: give every element a deterministic box and ResizeObserver. */
beforeEach(() => {
  // A faithful double: a real ResizeObserver delivers an initial observation as
  // soon as `observe()` is called, which is what triggers the first measurement.
  class ResizeObserverStub {
    private callback: ResizeObserverCallback
    constructor(callback: ResizeObserverCallback) {
      this.callback = callback
    }
    observe(target: Element) {
      this.callback(
        [{ target } as unknown as ResizeObserverEntry],
        this as unknown as ResizeObserver,
      )
    }
    unobserve() {}
    disconnect() {}
  }
  vi.stubGlobal('ResizeObserver', ResizeObserverStub)
  vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue({
    width: 300,
    height: 200,
    top: 0,
    left: 0,
    right: 300,
    bottom: 200,
    x: 0,
    y: 0,
    toJSON: () => ({}),
  } as DOMRect)
})

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

function tileCount() {
  return screen.queryAllByTestId(/^tour-gallery-tile-\d+$/).length
}

describe('TourImageGallery — GetYourGuide mosaic', () => {
  it('lays out left 20% / centre 54% / right (rest) with one tile per photo', async () => {
    const { container } = render(<TourImageGallery images={IMAGES} title="Accra City Tour" />)

    await waitFor(() => expect(tileCount()).toBe(4))

    const columns = Array.from(container.querySelectorAll<HTMLElement>('.tour-gallery-mosaic-column'))
    expect(columns).toHaveLength(3)
    expect(columns[0].style.flexBasis).toBe('20%')
    expect(columns[1].style.flexBasis).toBe('54%')
    expect(columns[2].style.flexGrow).toBe('1')
    expect(columns[2].style.flexBasis).toBe('0%')
    // right column stacks two tiles (4 visible photos, like GYG)
    expect(columns[2].querySelectorAll('.tour-gallery-tile')).toHaveLength(2)
  })

  it('crops each tile at the CDN to the exact box it renders in', async () => {
    render(<TourImageGallery images={IMAGES} title="Accra City Tour" />)

    await waitFor(() => expect(tileCount()).toBe(4))

    const img = screen.getByTestId('tour-gallery-tile-0').querySelector('img')!
    // 1x box is 300×200 → the browser never crops or upscales anything
    expect(img.getAttribute('src')).toContain('c_fill,g_auto,w_600,h_400,q_auto:good,f_auto')
    expect(img.getAttribute('srcset')).toContain('c_fill,g_auto,w_300,h_200,q_auto:good,f_auto')
    expect(img.getAttribute('srcset')).toContain('c_fill,g_auto,w_600,h_400,q_auto:good,f_auto')
  })

  it('snaps the tile crop height to a stable bucket so sub-bucket resizes keep the same CDN URL', async () => {
    // 203px is inside the 200px bucket: the crop must stay h_400 (a 200px box),
    // not re-download at h_406 every time the booking card settles by a pixel.
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue({
      width: 300,
      height: 203,
      top: 0,
      left: 0,
      right: 300,
      bottom: 203,
      x: 0,
      y: 0,
      toJSON: () => ({}),
    } as DOMRect)

    render(<TourImageGallery images={IMAGES} title="Accra City Tour" />)

    await waitFor(() => expect(tileCount()).toBe(4))

    const img = screen.getByTestId('tour-gallery-tile-0').querySelector('img')!
    expect(img.getAttribute('src')).toContain('c_fill,g_auto,w_600,h_400,q_auto:good,f_auto')
    expect(img.getAttribute('height')).toBe('200')
  })

  it('opens the lightbox on the tile that was clicked', async () => {
    render(<TourImageGallery images={IMAGES} title="Accra City Tour" />)
    await waitFor(() => expect(tileCount()).toBe(4))

    fireEvent.click(screen.getByTestId('tour-gallery-tile-2'))

    expect(await screen.findByText('3 / 5')).toBeTruthy()
  })

  it('opens the lightbox on the first photo from "Show all photos"', async () => {
    const { container } = render(<TourImageGallery images={IMAGES} title="Accra City Tour" />)
    await waitFor(() => expect(tileCount()).toBe(4))

    fireEvent.click(container.querySelector('.tour-gallery-show-all')!)

    expect(await screen.findByText('1 / 5')).toBeTruthy()
  })

  it('renders the round arrow-only back button and fires onBack', () => {
    const onBack = vi.fn()
    render(<TourImageGallery images={IMAGES} title="Accra City Tour" onBack={onBack} />)

    const back = screen.getByLabelText(/go back/i)
    expect(back.className).toContain('tour-gallery-back')
    // Round white icon button: an SVG arrow, no label text.
    expect(back.textContent).toBe('')
    expect(back.querySelector('svg')).toBeTruthy()

    fireEvent.click(back)
    expect(onBack).toHaveBeenCalledTimes(1)
  })

  it('retires the gallery back button when hideBack is set', () => {
    render(<TourImageGallery images={IMAGES} title="Accra City Tour" onBack={vi.fn()} hideBack />)

    expect(screen.queryByLabelText(/go back/i)).toBeNull()
  })

  it('degrades to a single full-width tile for a one-photo tour', async () => {
    const { container } = render(<TourImageGallery images={IMAGES.slice(0, 1)} title="Solo" />)

    await waitFor(() => expect(tileCount()).toBe(1))

    const columns = Array.from(container.querySelectorAll<HTMLElement>('.tour-gallery-mosaic-column'))
    expect(columns).toHaveLength(1)
    expect(columns[0].style.flexBasis).toBe('100%')
  })

  it('renders one pagination bullet per photo for the mobile carousel', () => {
    const { container } = render(<TourImageGallery images={IMAGES} title="Accra City Tour" />)

    expect(container.querySelectorAll('.tour-gallery-dot')).toHaveLength(IMAGES.length)
  })

  it('warms every viewer photo on load so "next" never waits on the network', async () => {
    // Run the idle callback immediately, and record what the prefetcher requests.
    class ImageStub {
      decoding = ''
      sizes = ''
      src = ''
      srcset = ''
      constructor() {
        created.push(this)
      }
    }
    const created: ImageStub[] = []
    vi.stubGlobal('Image', ImageStub)
    vi.stubGlobal('requestIdleCallback', (cb: IdleRequestCallback) => {
      cb({ didTimeout: false, timeRemaining: () => 50 } as IdleDeadline)
      return 1
    })
    vi.stubGlobal('cancelIdleCallback', () => {})

    render(<TourImageGallery images={IMAGES} title="Accra City Tour" />)

    await waitFor(() => expect(created).toHaveLength(IMAGES.length))
    // Same URL the viewer requests: uncropped (c_limit) with the viewer's srcset.
    for (const img of created) {
      expect(img.src).toContain('c_limit')
      expect(img.srcset).toContain('c_limit')
      expect(img.sizes).toBe('100vw')
    }
  })
})
