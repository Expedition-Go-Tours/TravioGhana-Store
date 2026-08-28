import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent, within, waitFor } from '@testing-library/react'
import TravelersLoved, { type TravelerLovedReview } from './TravelersLoved'
import { SAMPLE_TRAVELERS_LOVED } from '../../data/sampleTravelersLoved'

const reviews: TravelerLovedReview[] = [
  { id: '1', name: 'Ama Mensah', date: 'Mar 2025', rating: 5, title: 'Unforgettable', text: 'Amazing experience, the guide was fantastic.' },
  { id: '2', name: 'Kwame Boateng', date: 'Jan 2025', rating: 4, title: 'Great day', text: 'Really enjoyed the scenery and the pace of the tour.' },
  { id: '3', name: 'Yaa Asantewaa', date: 'Feb 2025', rating: 5, title: 'Highly recommended', text: 'Worth every penny, I would do it again.' },
  { id: '4', name: 'Kojo Antwi', date: 'Dec 2024', rating: 3, title: 'Okay', text: 'It was decent but a bit crowded.' },
]

describe('TravelersLoved', () => {
  it('shows sample reviews when the tour has no real reviews yet', () => {
    render(<TravelersLoved reviews={[]} onViewAllReviews={() => {}} />)

    expect(screen.getByText('What travellers loved')).toBeInTheDocument()
    expect(screen.getByText(SAMPLE_TRAVELERS_LOVED[0].name)).toBeInTheDocument()
    expect(screen.getByText(SAMPLE_TRAVELERS_LOVED[0].title!)).toBeInTheDocument()
  })

  it('hides the sample badge and shows real reviews when they exist', () => {
    render(<TravelersLoved reviews={reviews} onViewAllReviews={() => {}} />)

    expect(screen.getByText('What travellers loved')).toBeInTheDocument()
    expect(screen.queryByText('Sample reviews')).not.toBeInTheDocument()
    expect(screen.getByText('Ama Mensah')).toBeInTheDocument()
    expect(screen.queryByText(SAMPLE_TRAVELERS_LOVED[0].name)).not.toBeInTheDocument()
  })

  it('renders the "What travellers loved" section with reviews', () => {
    render(<TravelersLoved reviews={reviews} onViewAllReviews={() => {}} />)
    expect(screen.getByText('What travellers loved')).toBeInTheDocument()
    expect(screen.getByText('Ama Mensah')).toBeInTheDocument()
    expect(screen.getByText('Unforgettable')).toBeInTheDocument()
  })

  it('renders every review, ordered by highest rating first', () => {
    render(<TravelersLoved reviews={reviews} onViewAllReviews={() => {}} />)

    // All four reviews render; the carousel browses the full set.
    expect(screen.getByText('Ama Mensah')).toBeInTheDocument()
    expect(screen.getByText('Yaa Asantewaa')).toBeInTheDocument()
    expect(screen.getByText('Kwame Boateng')).toBeInTheDocument()
    expect(screen.getByText('Kojo Antwi')).toBeInTheDocument()

    // 5-star reviews come before the 4-star and 3-star ones in the DOM.
    const names = screen.getAllByText(/^(Ama Mensah|Yaa Asantewaa|Kwame Boateng|Kojo Antwi)$/)
    const order = names.map((n) => n.textContent)
    expect(order.indexOf('Ama Mensah')).toBeLessThan(order.indexOf('Kwame Boateng'))
    expect(order.indexOf('Yaa Asantewaa')).toBeLessThan(order.indexOf('Kojo Antwi'))
  })

  it('exposes prev/next carousel controls', () => {
    render(<TravelersLoved reviews={reviews} onViewAllReviews={() => {}} />)

    expect(screen.getByLabelText('Previous reviews')).toBeInTheDocument()
    expect(screen.getByLabelText('Next reviews')).toBeInTheDocument()
  })

  it('calls onViewAllReviews when "See all reviews" is clicked', () => {
    const onViewAllReviews = vi.fn()
    render(<TravelersLoved reviews={reviews} onViewAllReviews={onViewAllReviews} />)

    fireEvent.click(screen.getByText(/See all reviews/))
    expect(onViewAllReviews).toHaveBeenCalledTimes(1)
  })

  it('opens a full-detail modal when "See more" is clicked on a long review', async () => {
    const longText =
      'This is an exceptionally detailed review that goes on for quite a while. ' +
      'It contains a lot of useful information about the tour, the guide, the food, ' +
      'the scenery and everything else a potential traveler might want to know before booking.'
    render(
      <TravelersLoved
        reviews={[{ id: 'long', name: 'Efua Sarpong', date: 'Apr 2025', rating: 5, text: longText }]}
        onViewAllReviews={() => {}}
      />
    )

    const toggle = screen.getByText('See more')
    expect(toggle).toBeInTheDocument()

    fireEvent.click(toggle)
    const dialog = screen.getByRole('dialog')
    expect(dialog).toBeInTheDocument()
    expect(within(dialog).getByText(longText)).toBeInTheDocument()

    fireEvent.click(screen.getByLabelText('Close review'))
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
  })
})
