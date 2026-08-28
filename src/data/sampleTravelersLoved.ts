import type { TravelerLovedReview } from '../pages/tour-detail/TravelersLoved'

// Placeholder reviews shown in the "What travellers loved" section while a
// tour has no real traveller reviews yet. They are replaced automatically by
// the live reviews as soon as real data becomes available.
export const SAMPLE_TRAVELERS_LOVED: TravelerLovedReview[] = [
  {
    id: 'sample-1',
    name: 'Amara Osei',
    date: 'Jun 2025',
    rating: 5,
    title: 'Absolutely worth it',
    text: 'An incredible experience from start to finish. The guide was knowledgeable, the pacing was perfect, and we always felt safe and well taken care of.',
  },
  {
    id: 'sample-2',
    name: 'Daniel Mensah',
    date: 'May 2025',
    rating: 5,
    title: 'Best tour of our trip',
    text: 'This was the highlight of our entire holiday. Amazing views, great stories and a friendly group. Highly recommended for anyone visiting.',
  },
  {
    id: 'sample-3',
    name: 'Naa Adjeley',
    date: 'Apr 2025',
    rating: 4,
    title: 'Great day out',
    text: 'Really enjoyed it. Well organised and the local food stop was a lovely touch. Would have liked a little more time at the final stop.',
  },
  {
    id: 'sample-4',
    name: 'Kwabena Darko',
    date: 'Mar 2025',
    rating: 5,
    title: 'Seamless from start to finish',
    text: 'Booking was easy, pickup was on time and the whole day ran like clockwork. Our guide went above and beyond to make sure everyone was comfortable.',
  },
  {
    id: 'sample-5',
    name: 'Efua Quist',
    date: 'Feb 2025',
    rating: 4,
    title: 'Beautiful scenery',
    text: 'The views were breathtaking and we got so many great photos. Only downside was a bit of traffic on the way back, but that is no fault of the tour.',
  },
  {
    id: 'sample-6',
    name: 'Kofi Adom',
    date: 'Jan 2025',
    rating: 5,
    title: 'Would book again in a heartbeat',
    text: 'Everything about this experience was first class. From the comfortable transport to the passionate storytelling, it felt genuinely personal and well crafted.',
  },
  {
    id: 'sample-7',
    name: 'Abena Sarpong',
    date: 'Dec 2024',
    rating: 3,
    title: 'Good but crowded',
    text: 'The tour itself was good and the guide was friendly, but the group was larger than expected which made some of the stops feel a little rushed.',
  },
]
