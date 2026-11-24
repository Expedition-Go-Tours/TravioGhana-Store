import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import VerticalSwitch from './VerticalSwitch'

function renderSwitch(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <VerticalSwitch />
    </MemoryRouter>,
  )
}

describe('VerticalSwitch', () => {
  it('links to both verticals and marks Tours active on the homepage', () => {
    renderSwitch('/')
    const tours = screen.getByRole('link', { name: 'Tours & Activities' })
    const restaurants = screen.getByRole('link', { name: 'Restaurants' })

    expect(tours).toHaveAttribute('href', '/')
    expect(tours).toHaveAttribute('aria-current', 'page')
    expect(restaurants).toHaveAttribute('href', '/restaurants')
    expect(restaurants).not.toHaveAttribute('aria-current')
  })

  it('marks Restaurants active on its route', () => {
    renderSwitch('/restaurants')
    expect(screen.getByRole('link', { name: 'Restaurants' })).toHaveAttribute('aria-current', 'page')
    expect(screen.getByRole('link', { name: 'Tours & Activities' })).not.toHaveAttribute('aria-current')
  })

  it('keeps Restaurants active on a nested URL', () => {
    renderSwitch('/restaurants/accra')
    expect(screen.getByRole('link', { name: 'Restaurants' })).toHaveAttribute('aria-current', 'page')
  })
})
