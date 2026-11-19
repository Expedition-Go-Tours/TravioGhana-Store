import { beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import type { AuthUser } from '../lib/auth'
import NewsletterSection from './NewsletterSection'

const state = vi.hoisted(() => ({ user: null as AuthUser | null }))

vi.mock('../hooks/useAuthUser', () => ({
  useAuthUser: () => state.user,
}))

function renderSection() {
  return render(
    <MemoryRouter>
      <NewsletterSection />
    </MemoryRouter>,
  )
}

describe('NewsletterSection email prefill', () => {
  beforeEach(() => {
    cleanup()
    state.user = null
  })

  it('leaves the field empty for a signed-out visitor', () => {
    renderSection()

    expect(screen.getByLabelText('Email address')).toHaveValue('')
  })

  it('prefills the signed-in account email', () => {
    state.user = { id: 'u1', email: 'ada@example.com' }
    renderSection()

    expect(screen.getByLabelText('Email address')).toHaveValue('ada@example.com')
  })

  it('prefills when a signed-out visitor signs in', () => {
    const view = renderSection()
    expect(screen.getByLabelText('Email address')).toHaveValue('')

    state.user = { id: 'u1', email: 'ada@example.com' }
    view.rerender(
      <MemoryRouter>
        <NewsletterSection />
      </MemoryRouter>,
    )

    expect(screen.getByLabelText('Email address')).toHaveValue('ada@example.com')
  })

  it('clears the field when the user signs out', async () => {
    state.user = { id: 'u1', email: 'ada@example.com' }
    const view = renderSection()
    expect(screen.getByLabelText('Email address')).toHaveValue('ada@example.com')

    state.user = null
    view.rerender(
      <MemoryRouter>
        <NewsletterSection />
      </MemoryRouter>,
    )

    await waitFor(() => expect(screen.getByLabelText('Email address')).toHaveValue(''))
  })

  it('does not overwrite an address the visitor has typed', () => {
    state.user = { id: 'u1', email: 'ada@example.com' }
    const view = renderSection()
    const input = screen.getByLabelText('Email address')

    fireEvent.change(input, { target: { value: 'newsletter@example.com' } })
    view.rerender(
      <MemoryRouter>
        <NewsletterSection />
      </MemoryRouter>,
    )

    expect(screen.getByLabelText('Email address')).toHaveValue('newsletter@example.com')
  })
})
