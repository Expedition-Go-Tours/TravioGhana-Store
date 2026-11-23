import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, cleanup, waitFor } from '@testing-library/react'
import TourImageGallery, { buildMobilePages } from './TourImageGallery'

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

describe('TourImageGallery — desktop mosaic', () => {
  it('lays out a large hero tile on the left with the next photos stacked on the right', async () => {
    const { container } = render(<TourImageGallery images={IMAGES} title="Accra City Tour" />)

    await waitFor(() => expect(tileCount()).toBe(4))

    const columns = Array.from(container.querySelectorAll<HTMLElement>('.tour-gallery-mosaic-column'))
    expect(columns).toHaveLength(2)
    // hero tile carries the cover photo and ~2/3 of the width
    expect(columns[0].style.flexBasis).toBe('68%')
    expect(columns[0].querySelectorAll('.tour-gallery-tile')).toHaveLength(1)
    // right column takes the remainder and stacks three tiles
    expect(columns[1].style.flexGrow).toBe('1')
    expect(columns[1].style.flexBasis).toBe('0%')
    expect(columns[1].querySelectorAll('.tour-gallery-tile')).toHaveLength(3)
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

  it('renders one pagination bullet per mobile page, not per photo', () => {
    // 5 photos → hero, single, single, view all = 4 pages.
    const { container } = render(<TourImageGallery images={IMAGES} title="Accra City Tour" />)

    expect(container.querySelectorAll('.tour-gallery-page')).toHaveLength(4)
    expect(container.querySelectorAll('.tour-gallery-dot')).toHaveLength(4)
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

describe('buildMobilePages', () => {
  it('builds the reference five pages from eight or more photos', () => {
    expect(buildMobilePages(8).map((page) => page.kind)).toEqual([
      'hero',
      'single',
      'stacked',
      'single',
      'viewAll',
    ])
  })

  it('consumes the photos in the order the pages show them', () => {
    const pages = buildMobilePages(8)
    expect(pages[0].indexes).toEqual([0, 1, 2])
    expect(pages[1].indexes).toEqual([3])
    expect(pages[2].indexes).toEqual([4, 5, 6])
    expect(pages[3].indexes).toEqual([7])
  })

  it('stops when the photos run out instead of repeating one to pad the count', () => {
    expect(buildMobilePages(1).map((page) => page.kind)).toEqual(['single'])
    expect(buildMobilePages(2).map((page) => page.kind)).toEqual(['twoUp'])
    expect(buildMobilePages(3).map((page) => page.kind)).toEqual(['hero'])
    expect(buildMobilePages(4).map((page) => page.kind)).toEqual(['hero', 'single', 'viewAll'])
    expect(buildMobilePages(6).map((page) => page.kind)).toEqual([
      'hero',
      'single',
      'twoUp',
      'viewAll',
    ])
    expect(buildMobilePages(7).map((page) => page.kind)).toEqual([
      'hero',
      'single',
      'stacked',
      'viewAll',
    ])
  })

  it('has no pages for an empty gallery', () => {
    expect(buildMobilePages(0)).toEqual([])
  })
})

describe('TourImageGallery — mobile pages', () => {
  it('lays the first page out as a hero with two tiles beneath it', () => {
    render(<TourImageGallery images={IMAGES} title="Accra City Tour" />)

    const page = screen.getByTestId('tour-gallery-page-0')
    expect(page.getAttribute('data-page')).toBe('hero')
    expect(page.querySelectorAll('.tour-gallery-mobile-tile')).toHaveLength(3)
    expect(page.querySelectorAll('.tour-gallery-hero-row > *')).toHaveLength(2)
  })

  it('lays the stacked page out as two tiles beside one tall tile', () => {
    const eight = Array.from(
      { length: 8 },
      (_, i) => `https://res.cloudinary.com/demo/image/upload/v1/tour/p-${i}.jpg`,
    )
    render(<TourImageGallery images={eight} title="Eight Photos" />)

    const page = screen.getByTestId('tour-gallery-page-2')
    expect(page.getAttribute('data-page')).toBe('stacked')
    expect(page.querySelectorAll('.tour-gallery-mobile-tile')).toHaveLength(3)
  })

  it('moves a whole page per swipe through a scroll-snap strip', () => {
    const { container } = render(<TourImageGallery images={IMAGES} title="Accra City Tour" />)

    const scroller = container.querySelector('.tour-gallery-mobile-scroller')!
    expect(scroller).toBeTruthy()
    // The pages, not the photos, are the snap targets.
    expect(scroller.querySelectorAll('.tour-gallery-page')).toHaveLength(4)
    expect(scroller.getAttribute('aria-roledescription')).toBe('carousel')
  })

  it('opens the lightbox on the first photo from the View all page', async () => {
    render(<TourImageGallery images={IMAGES} title="Accra City Tour" />)

    const viewAll = screen
      .getByTestId('tour-gallery-page-3')
      .querySelector('.tour-gallery-view-all')!
    fireEvent.click(viewAll)

    expect(await screen.findByText('1 / 5')).toBeTruthy()
  })

  it('wires the save and share overlays to their handlers', () => {
    const onToggleSave = vi.fn()
    const onShare = vi.fn()

    render(
      <TourImageGallery
        images={IMAGES}
        title="Accra City Tour"
        isSaved
        onToggleSave={onToggleSave}
        onShare={onShare}
      />,
    )

    const save = screen.getByLabelText(/remove from wishlist/i)
    // The saved state is visible, not just internal.
    expect(save.getAttribute('aria-pressed')).toBe('true')

    fireEvent.click(save)
    expect(onToggleSave).toHaveBeenCalledTimes(1)

    fireEvent.click(screen.getByLabelText(/^share$/i))
    expect(onShare).toHaveBeenCalledTimes(1)
  })

  it('renders no save/share controls when the page does not pass them', () => {
    const { container } = render(<TourImageGallery images={IMAGES} title="Accra City Tour" />)

    expect(container.querySelector('.tour-gallery-mobile-actions')).toBeNull()
  })
})
