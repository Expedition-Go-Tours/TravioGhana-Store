import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, fireEvent, cleanup, waitFor } from '@testing-library/react'
import GalleryDialog from './GalleryDialog'

const IMAGES = [
  'https://res.cloudinary.com/demo/image/upload/v1/tour/photo-0.jpg',
  'https://res.cloudinary.com/demo/image/upload/v1/tour/photo-1.jpg',
  'https://res.cloudinary.com/demo/image/upload/v1/tour/photo-2.jpg',
]

function renderDialog({ open = true, initialIndex = 0 } = {}) {
  const onOpenChange = vi.fn()
  const utils = render(
    <GalleryDialog
      open={open}
      onOpenChange={onOpenChange}
      images={IMAGES}
      initialIndex={initialIndex}
    />,
  )
  return { onOpenChange, ...utils }
}

afterEach(cleanup)

describe('GalleryDialog — GetYourGuide lightbox', () => {
  it('renders nothing while closed', () => {
    const { container } = renderDialog({ open: false })
    expect(container.firstChild).toBeNull()
    expect(document.querySelector('.gallery-dialog')).toBeNull()
  })

  it('portals to <body> so no ancestor stacking context can trap it', () => {
    const { container } = renderDialog()

    const dialog = document.querySelector('.gallery-dialog')
    expect(dialog).not.toBeNull()
    // It must not live inside the render container, otherwise the fixed navbar
    // (z-index 100) paints over its close button and counter.
    expect(container.contains(dialog)).toBe(false)
  })

  it('shows a close button that closes the viewer', () => {
    const { onOpenChange } = renderDialog()

    const close = screen.getByRole('button', { name: /close/i })
    expect(close.className).toContain('gallery-dialog-close')

    fireEvent.click(close)
    expect(onOpenChange).toHaveBeenCalledWith(false)
  })

  it('opens directly in the viewer on the requested photo', () => {
    renderDialog({ initialIndex: 2 })
    expect(screen.getByText('3 / 3')).toBeTruthy()
  })

  it('scales the photo to fill the box instead of leaving it at its intrinsic size', () => {
    renderDialog()
    const img = document.querySelector('.gallery-viewer-image')!

    // no CDN crop, and the CSS box is the full available area
    const src = img.getAttribute('src') ?? ''
    expect(src).toContain('c_limit')
    expect(src).not.toContain('c_fill')
    expect((img as HTMLElement).style.objectFit).toBe('contain')
    // eager: a lazy image in a 0-sized box never loads (the "tiny photo" bug)
    expect(img.getAttribute('loading')).toBe('eager')
  })

  it('navigates with the arrow keys', () => {
    renderDialog()

    fireEvent.keyDown(window, { key: 'ArrowRight' })
    expect(screen.getByText('2 / 3')).toBeTruthy()

    fireEvent.keyDown(window, { key: 'ArrowLeft' })
    expect(screen.getByText('1 / 3')).toBeTruthy()
  })

  it('wraps around at both ends', () => {
    renderDialog()

    fireEvent.keyDown(window, { key: 'ArrowLeft' })
    expect(screen.getByText('3 / 3')).toBeTruthy()
  })

  it('closes on Escape', () => {
    const { onOpenChange } = renderDialog()

    fireEvent.keyDown(window, { key: 'Escape' })

    expect(onOpenChange).toHaveBeenCalledWith(false)
  })

  it('moves focus into the dialog when it opens', async () => {
    renderDialog()

    await waitFor(() =>
      expect(document.activeElement).toBe(document.querySelector('.gallery-dialog-close')),
    )
  })

  it('locks body scroll while open and restores it after', () => {
    const { unmount } = renderDialog()
    expect(document.body.style.overflow).toBe('hidden')

    unmount()
    expect(document.body.style.overflow).toBe('')
  })
})
