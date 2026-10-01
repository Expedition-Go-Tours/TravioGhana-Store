import { describe, expect, it } from 'vitest'
import { render } from '@testing-library/react'
import PartnersSection from './PartnersSection'

/**
 * The marquee ships each logo twice (the second set is the seamless-loop
 * clone, aria-hidden). Only the three marketplaces with a public page for the
 * operating company are links; every other card must stay inert.
 */
const PROFILE_LINKS = {
  Tripadvisor:
    'https://www.tripadvisor.com/Attraction_Review-g293797-d24155300-Reviews-Expedition_Go_Tours_Ltd-Accra_Greater_Accra.html',
  GetYourGuide: 'https://www.getyourguide.com/expedition-go-tours-s484318/',
  Viator:
    'https://www.viator.com/tours/Accra/Touring-Cape-Coast/d5517-358551P1#:~:text=Supplied%20by-,Expedition%2DGo%20Tours%20Ltd,-Cancellation%20Policy',
}

function realAnchors(container: HTMLElement): HTMLAnchorElement[] {
  return Array.from(
    container.querySelectorAll<HTMLAnchorElement>(
      '.partner-logo-wrap:not([aria-hidden]) a.partner-logo-card',
    ),
  )
}

describe('PartnersSection profile links', () => {
  it('links the three marketplaces to the company pages', () => {
    const { container } = render(<PartnersSection />)
    const anchors = realAnchors(container)

    expect(anchors).toHaveLength(3)

    for (const [name, href] of Object.entries(PROFILE_LINKS)) {
      const anchor = anchors.find(
        (candidate) => candidate.querySelector('img')?.getAttribute('alt') === name,
      )
      expect(anchor, `${name} profile link`).toBeTruthy()
      expect(anchor).toHaveAttribute('href', href)
      expect(anchor).toHaveAttribute('target', '_blank')
      expect(anchor).toHaveAttribute('rel', 'noopener noreferrer')
    }
  })

  it('keeps the loop clones out of the keyboard order', () => {
    const { container } = render(<PartnersSection />)

    const cloneWraps = container.querySelectorAll('.partner-logo-wrap[aria-hidden]')
    expect(cloneWraps).toHaveLength(15) // the full second pass

    const cloneAnchors = container.querySelectorAll<HTMLAnchorElement>(
      '.partner-logo-wrap[aria-hidden] a.partner-logo-card',
    )
    expect(cloneAnchors).toHaveLength(3)
    for (const anchor of Array.from(cloneAnchors)) {
      expect(anchor).toHaveAttribute('tabindex', '-1')
    }

    // The visible set stays interactive.
    for (const anchor of realAnchors(container)) {
      expect(anchor).not.toHaveAttribute('tabindex')
    }
  })

  it('leaves partner cards without a public page inert', () => {
    const { container } = render(<PartnersSection />)
    const anchors = container.querySelectorAll('a.partner-logo-card').length

    // 3 profile cards × 2 marquee passes, no more.
    expect(anchors).toBe(6)

    const bookingCard = Array.from(
      container.querySelectorAll('.partner-logo-card'),
    ).find((card) => card.querySelector('img')?.getAttribute('alt') === 'Booking.com')
    expect(bookingCard?.tagName).toBe('DIV')
  })
})
