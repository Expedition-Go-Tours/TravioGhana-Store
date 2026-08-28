import type { TourDetail, Review, ReviewStats } from '../lib/tourTypes'

export const mockTourDetail: TourDetail = {
  id: '1',
  slug: 'accra-city-tour-markets-museums-local-cuisine',
  title: 'Accra City Tour: Markets, Museums & Local Cuisine',
  location: 'Accra, Greater Accra Region',
  price: 300,
  currency: 'USD',
  duration: '2 days',
  groupSize: 6,
  languages: ['English', 'Español'],
  rating: 5,
  reviewCount: 3,
  images: [
    'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=800',
    'https://images.unsplash.com/photo-1501785888041-af3ef285b470?w=800',
    'https://images.unsplash.com/photo-1476514525535-07fb3b4ae5f1?w=800',
    'https://images.unsplash.com/photo-1469854523086-cc02fe5d8800?w=800',
    'https://images.unsplash.com/photo-1502602898657-3e91760cbb34?w=800',
  ],
  videoUrl: 'https://www.youtube.com/watch?v=AmZ0WrEaf34',
  description: `Eum eu sumo albucius perfecto, commodo torquatos consequuntur pro ut, id posse splendide ius. Cu nisl putent omittantur usu, mutat atomorum ex pro, ius nibh nonumy id. Nam at eius dissentias disputando, molestie mnesarchum complectitur per te. In commune pericula mediocritatem per. Cu audiam dolorum appareat per, id habeo suavitate argumentum vel. Te his eros ludus tibique.

Iriure evertitur vix cu, ad has dictas mandamus explicari, ne vocibus consectetuer cum. Ea prima perfecto sed. Summo impedit mentitum cum ut. Verear prompta recteque ex vix. No cum quidam antiopam, numquam equidem eam ea. Eos eu hinc doctus interpretaris, quis mucius et ius.

Ridens reprimique sed ei, ei qui dicta officiis. Dicat intellegebat vim in, at fastidii prodesset gloriatur qui, sed dicam eripuit necessitatibus an. Has ex enim adolescens vituperata. Nam malorum debitis reprimique no, quaestio percipitur referrentur pro te.`,
  highlights: [
    'Visit eight villages showcasing Polynesian culture',
    'Canoe ride, tattoos, spear throwing, ukulele lessons and fishing',
    'Spectacular Polynesian evening dinner show \'Ha: Breath of Life\'',
    'Optional transportation from Waikiki hotels',
  ],
  included: [
    'Specialized bilingual guide',
    'Private Transport',
    'Entrance fees (Cable and car and Moon Valley)',
    'Box lunch water, banana apple and chocolate',
  ],
  excluded: [
    'Additional Services',
    'Insurance',
    'Drink',
    'Tickets',
  ],
  itinerary: [
    {
      day: 1,
      title: 'Nullam quis risus eget urna mollis ornare vel eu leo',
      description: 'Eum eu sumo albucius perfecto, commodo torquatos consequuntur pro ut, id posse splendide ius. Cu nisl putent omittantur usu, mutat atomorum ex pro, ius nibh nonumy id. Nam at eius dissentias disputando, molestie mnesarchum complectitur per te. In commune pericula mediocritatem per. Cu audiam dolorum appareat per, id habeo suavitate argumentum vel. Te his eros ludus tibique.',
      image: 'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=600',
      duration: 5,
      durationUnit: 'hour',
      activities: ['City tour', 'Museum visit', 'Local cuisine tasting'],
      meals: ['Breakfast', 'Lunch'],
    },
    {
      day: 2,
      title: 'Eum eu sumo albucius perfecto',
      description: 'Final day exploring the beautiful landscapes and cultural sites. Includes transportation back to starting point.',
      duration: 7,
      durationUnit: 'hour',
      activities: ['Mountain hiking', 'Scenic viewpoints', 'Shopping'],
      meals: ['Breakfast'],
    },
  ],
  faqs: [
    {
      id: 'faq-1',
      question: 'Eum eu sumo albucius perfecto?',
      answer: 'Eum eu sumo albucius perfecto, commodo torquatos consequuntur pro ut, id posse splendide ius. Cu nisl putent omittantur usu, mutat atomorum ex pro, ius nibh nonumy id.',
    },
    {
      id: 'faq-2',
      question: 'Nullam quis risus eget urna mollis ornare vel eu leo?',
      answer: 'Yes, this tour includes all necessary equipment and safety gear. Our experienced guides will ensure you have a safe and enjoyable experience.',
    },
    {
      id: 'faq-3',
      question: 'What should I bring?',
      answer: 'Comfortable walking shoes, sunscreen, hat, camera, and a light jacket. We recommend bringing a water bottle as well.',
    },
  ],
  coordinates: { lat: 40.7128, lng: -74.0060 },
  tourType: 'Daily Tour',
  availability: ['2024-03-01', '2024-03-02', '2024-03-05', '2024-03-08'],
  difficulty: 'Moderate',
  minAge: 12,
  pickupIncluded: true,
  cancellationPolicy: 'Free cancellation up to 24 hours before the tour starts',
  guide: {
    name: 'modtour',
    memberSince: '2022',
    avatar: 'https://i.pravatar.cc/300?img=12',
  },
  contact: {
    email: 'email@domain.com',
    website: 'http://www.domain.com',
    phone: '+658099999',
    fax: '+123456789',
  },
}

export const mockReviews: Review[] = [
  {
    id: 'review-1',
    tourId: '1',
    author: 'Customer',
    rating: 5,
    date: '2022-05-27',
    title: 'A Brilliant Trip',
    content: 'We have been on a couple of cycling trips before and this one was probably the best. Tri our guide was outstanding and all our fellow cyclists were a great bunch of people. We got a real flavour of life in Vietnam. Lots of interesting food. The meals were good and plentiful. Thought we would lose weight but didn\'t! Good Hotels. Many highlights but a couple or so to point out, Whale Island and Hoi An, the 30km exhilarating downhill ride and cycling in city centre traffic...... great fun but leaves your heart racing.',
    helpful: 12,
    verified: true,
  },
  {
    id: 'review-2',
    tourId: '1',
    author: 'Customer',
    rating: 5,
    date: '2022-05-27',
    title: 'Excellent, probably the best yet',
    content: 'This was an amazing trip. Totally fell in love with Vietnam. We did so much in such in two weeks. The cycling, somehow, only felt like a small part of the experience as there were so many other things that we did. Each day was full on, exceptionally well organised, great food, etc. Been on a few cycle trips, and I think this was the best one so far.',
    helpful: 8,
    verified: true,
  },
  {
    id: 'review-3',
    tourId: '1',
    author: 'Customer',
    rating: 4,
    date: '2022-05-27',
    title: 'Good \'ole Exodus!',
    content: 'An interesting blend of Vietnam from north to south including an o/n sleeper train. The success and enjoyment of these trips is usually down to the blend of fellow travellers and team leader and this one was no different. The weather, early season, was mixed with a little more rain and cloud than hoped for but did not detract from the enjoyment.',
    helpful: 5,
    verified: false,
  },
]

export const mockReviewStats: ReviewStats = {
  average: 4.7,
  total: 3,
  breakdown: {
    5: 2,
    4: 1,
    3: 0,
    2: 0,
    1: 0,
  },
}
