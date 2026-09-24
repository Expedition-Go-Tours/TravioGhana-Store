import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import Breadcrumb from './Breadcrumb'

describe('Breadcrumb', () => {
  it('renders the crumb trail without a back button', () => {
    render(
      <MemoryRouter>
        <Breadcrumb tour={{ title: 'Accra City Tour', location: 'Accra, Ghana' }} />
      </MemoryRouter>,
    )

    expect(screen.getByRole('link', { name: 'Home' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Accra' })).toBeInTheDocument()
    expect(screen.getByText('Accra City Tour')).toBeInTheDocument()
    // The back affordance lives on the image gallery — never in the breadcrumb.
    expect(screen.queryByRole('button')).not.toBeInTheDocument()
  })

  it('falls back to a Tours crumb when the tour has no location', () => {
    render(
      <MemoryRouter>
        <Breadcrumb tour={{ title: 'Mystery Tour' }} />
      </MemoryRouter>,
    )

    expect(screen.getByRole('link', { name: 'Tours' })).toBeInTheDocument()
  })
})
