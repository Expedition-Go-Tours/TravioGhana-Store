export interface Tour {
  title: string
  category: string
  duration: string
  features: string
  price: string
  rating: string
  reviews: number
  location: string
  image: string
  /** Additional tour photos — drives the image carousel on the tour card. */
  photos?: string[]
  discount?: string
  languages?: string[]
  difficulty?: string
  cancellationPolicy?: string
  pickupIncluded?: boolean
  /** Whether the supplier offers overnight accommodation (categorization.accommodationIncluded). */
  accommodationIncluded?: boolean
  /** How travelers assemble at the start: a fixed meeting point, or pickup. */
  meetingMode?: 'meeting_point' | 'pickup' | 'none'
  source?: 'Travio Ghana' | 'travio-ghana'
  externalUrl?: string
  /** Real backend tour ID, present only for tours fetched from the API (not the static mock lists below). Enables wishlist backend sync. */
  id?: string
}

export function getTourSlug(title: string): string {
  return title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
}

const dayTours: Tour[] = [
  {
    title: 'Full Day Accra City & Cultural Experience',
    category: 'Accra · Day trip',
    duration: 'Full day',
    features: 'Guide included · Lunch included',
    price: '$89',
    rating: '4.7',
    reviews: 56,
    location: 'Accra, Ghana',
    image: 'https://images.unsplash.com/photo-1519501025264-65ba15a82390?w=400&q=80',
    languages: ['English', 'Spanish'],
  },
  {
    title: 'Cape Coast Castles & Heritage Day Tour',
    category: 'Cape Coast · History',
    duration: '8 hours',
    features: 'Pickup available · Entry fees included',
    price: '$72',
    rating: '4.8',
    reviews: 43,
    location: 'Cape Coast, Ghana',
    image: 'https://images.unsplash.com/photo-1590868169155-f1a0c43106ef?w=400&q=80',
    source: 'travio-ghana',
    externalUrl: 'https://travioghana.com/tour/cape-coast-castle-heritage-tour',
  },
  {
    title: 'Kakum Canopy Walk & Rainforest Hike',
    category: 'Central · Adventure',
    duration: '6 hours',
    features: 'Guide included · Safety gear',
    price: '$65',
    rating: '4.9',
    reviews: 38,
    location: 'Kakum, Ghana',
    image: 'https://images.unsplash.com/photo-1516426122078-c23e76319801?w=400&q=80',
  },
  {
    title: 'Boti Falls Hike & Eastern Region Day Trip',
    category: 'Eastern · Nature',
    duration: 'Full day',
    features: 'Hiking gear · Guide · Lunch',
    price: '$55',
    rating: '4.6',
    reviews: 24,
    location: 'Eastern Region, Ghana',
    image: 'https://images.unsplash.com/photo-1578926378480-5e050966f37e?w=400&q=80',
  },
  {
    title: 'Lake Volta Sunset Cruise Day Tour',
    category: 'Volta · Cruise',
    duration: '6 hours',
    features: 'Drinks included · Return transfer',
    price: '$78',
    rating: '4.7',
    reviews: 31,
    location: 'Volta Region, Ghana',
    image: 'https://images.unsplash.com/photo-1544551763-46a013bb70d5?w=400&q=80',
  },
  {
    title: 'Jamestown Walking & Street Food Tour',
    category: 'Accra · Food',
    duration: 'Half day',
    features: 'Local guide · Tastings included',
    price: '$42',
    rating: '4.6',
    reviews: 47,
    location: 'Accra, Ghana',
    image: 'https://images.unsplash.com/photo-1591843336309-cbfcbad9b118?w=400&q=80',
  },
  {
    title: 'Mole National Park Safari Day Experience',
    category: 'Northern · Safari',
    duration: 'Full day',
    features: 'Park fees · Guide · Lunch',
    price: '$95',
    rating: '4.9',
    reviews: 22,
    location: 'Northern Region, Ghana',
    image: 'https://images.unsplash.com/photo-1583417319070-4a69db38a482?w=400&q=80',
  },
  {
    title: 'Shai Hills Rock Climbing & Nature Walk',
    category: 'Accra · Adventure',
    duration: '6 hours',
    features: 'Climbing gear · Guide · Lunch',
    price: '$58',
    rating: '4.5',
    reviews: 19,
    location: 'Greater Accra, Ghana',
    image: 'https://images.unsplash.com/photo-1441974231531-c6227db76b6e?w=400&q=80',
  },
  {
    title: 'Elmina Fishing Village & Dutch Heritage',
    category: 'Elmina · Cultural',
    duration: '5 hours',
    features: 'Local guide · Entry fees',
    price: '$48',
    rating: '4.5',
    reviews: 28,
    location: 'Elmina, Ghana',
    image: 'https://images.unsplash.com/photo-1518546305927-5a555bb7020d?w=400&q=80',
  },
  {
    title: 'Ada Foah Beach Escape & River Cruise',
    category: 'Greater Accra · Leisure',
    duration: 'Full day',
    features: 'Lunch included · Beach access',
    price: '$68',
    rating: '4.6',
    reviews: 35,
    location: 'Ada Foah, Ghana',
    image: 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=400&q=80',
  },
  {
    title: 'Accra Street Food & Nightlife Tour',
    category: 'Accra · Food',
    duration: '4 hours',
    features: 'Tastings · Guide · Drinks',
    price: '$45',
    rating: '4.8',
    reviews: 23,
    location: 'Accra, Ghana',
    image: 'https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=400&q=80',
    languages: ['English'],
  },
  {
    title: 'Boti Falls & Aburi Botanical Gardens Day Trip',
    category: 'Eastern · Nature',
    duration: '7 hours',
    features: 'Guide · Lunch · Entry fees',
    price: '$55',
    rating: '4.7',
    reviews: 18,
    location: 'Eastern Region, Ghana',
    image: 'https://images.unsplash.com/photo-1441974231531-c6227db76b6e?w=400&q=80',
    languages: ['English'],
  },
  {
    title: 'Experience the Beauty, History & Culture of Accra in a Day',
    category: 'Accra · Cultural',
    duration: 'Full day',
    features: 'Guide · Entry fees · Lunch',
    price: '$75',
    rating: '4.7',
    reviews: 0,
    location: 'Accra, Ghana',
    image: 'https://images.unsplash.com/photo-1582268611958-ebfd161ef9cf?w=400&q=80',
    languages: ['English'],
    source: 'travio-ghana',
    externalUrl: 'https://travioghana.com/tour/experience-the-beauty-history-and-the-culture-of-accra-in-a-day',
  },
  {
    title: 'Accra City Explorer',
    category: 'Accra · City tour',
    duration: 'Full day',
    features: 'Guide · Entry fees',
    price: '$70',
    rating: '4.7',
    reviews: 0,
    location: 'Accra, Ghana',
    image: 'https://images.unsplash.com/photo-1519501025264-65ba15a82390?w=400&q=80',
    languages: ['English'],
    source: 'travio-ghana',
    externalUrl: 'https://travioghana.com/tour/accra-city-explorer',
  },
  {
    title: 'The Accra Road Trip Experience',
    category: 'Accra · Adventure',
    duration: 'Full day',
    features: 'Guide · Transport · Lunch',
    price: '$80',
    rating: '4.7',
    reviews: 0,
    location: 'Accra, Ghana',
    image: 'https://images.unsplash.com/photo-1517457373958-b7bdd4587205?w=400&q=80',
    languages: ['English'],
    source: 'travio-ghana',
    externalUrl: 'https://travioghana.com/tour/the-accra-road-trip-experience',
  },
  {
    title: 'Accra City Highlights & Local Market Tour',
    category: 'Accra · Guided tour',
    duration: '4 hours',
    features: 'Guide · Tastings · Hotel pickup',
    price: '$65',
    rating: '4.7',
    reviews: 34,
    location: 'Accra, Ghana',
    image: 'https://images.unsplash.com/photo-1590868169155-f1a0c43106ef?w=400&q=80',
    languages: ['English'],
    source: 'travio-ghana',
    externalUrl: 'https://travioghana.com/tour/accra-city-highlights',
  },
  {
    title: 'Kumasi Cultural Walk & Ashanti Heritage Tour',
    category: 'Kumasi · Cultural',
    duration: '6 hours',
    features: 'Guide · Entry fees · Lunch',
    price: '$55',
    rating: '4.9',
    reviews: 28,
    location: 'Kumasi, Ghana',
    image: 'https://images.unsplash.com/photo-1516426122078-c23e76319801?w=400&q=80',
    languages: ['English', 'French'],
    source: 'travio-ghana',
    externalUrl: 'https://travioghana.com/tour/kumasi-cultural-walk',
  },
  {
    title: 'Ada Foah Water Sports & Boat Cruise',
    category: 'Greater Accra · Adventure',
    duration: 'Full day',
    features: 'Lunch · Drinks · Equipment',
    price: '$75',
    rating: '4.6',
    reviews: 42,
    location: 'Ada Foah, Ghana',
    image: 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=400&q=80',
    languages: ['English'],
    source: 'travio-ghana',
    externalUrl: 'https://travioghana.com/tour/ada-foah-cruise',
  },
  {
    title: 'Volta Region Waterfalls & Scenic Hike',
    category: 'Volta · Nature',
    duration: '8 hours',
    features: 'Guide · Lunch · Park fees',
    price: '$60',
    rating: '4.7',
    reviews: 15,
    location: 'Volta Region, Ghana',
    image: 'https://images.unsplash.com/photo-1441974231531-c6227db76b6e?w=400&q=80',
    languages: ['English', 'French'],
    source: 'travio-ghana',
    externalUrl: 'https://travioghana.com/tour/volta-waterfalls',
  },
]

export interface MultiDayTour {
  title: string
  days: string
  accommodation: string
  highlights: string
  price: string
  rating: string
  reviews: number
  location: string
  image: string
  languages?: string[]
  source?: 'Travio Ghana' | 'travio-ghana'
  externalUrl?: string
  /** Real backend tour ID, present only for tours fetched from the API. Enables wishlist backend sync. */
  id?: string
}

const multiDayTours: MultiDayTour[] = [
  {
    title: 'Northern Ghana Safari & Cultural Expedition',
    days: '5 days',
    accommodation: 'Lodge & Camping',
    highlights: 'Mole Park · Larabanga Mosque · Paga',
    price: '$520',
    rating: '4.9',
    reviews: 28,
    location: 'Northern Region, Ghana',
    image: 'https://images.unsplash.com/photo-1549366021-9f761d450615?w=400&q=80',
    languages: ['English', 'French'],
  },
  {
    title: 'Coastal Heritage & Beaches Journey',
    days: '4 days',
    accommodation: 'Beach Resort',
    highlights: 'Cape Coast · Elmina · Busua Beach',
    price: '$440',
    rating: '4.8',
    reviews: 35,
    location: 'Central Region, Ghana',
    image: 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=400&q=80',
  },
  {
    title: 'Ashanti Kingdom & Kumasi Explorer',
    days: '3 days',
    accommodation: 'City Hotel',
    highlights: 'Manhyia Palace · Kejetia Market · Craft villages',
    price: '$310',
    rating: '4.7',
    reviews: 22,
    location: 'Kumasi, Ghana',
    image: 'https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?w=400&q=80',
    languages: ['English', 'Twi'],
    source: 'travio-ghana',
    externalUrl: 'https://travioghana.com/tour/the-kumasi-tour-experience',
  },
  {
    title: 'Volta Region Waterfalls & Nature Trek',
    days: '4 days',
    accommodation: 'Eco Lodge',
    highlights: 'Wli Falls · Lake Volta · Tafi Atome',
    price: '$395',
    rating: '4.8',
    reviews: 19,
    location: 'Volta Region, Ghana',
    image: 'https://images.unsplash.com/photo-1432405972618-c60b0225b8f9?w=400&q=80',
  },
  {
    title: 'Greater Accra City & Beach Getaway',
    days: '3 days',
    accommodation: 'Boutique Hotel',
    highlights: 'Accra tours · Ada Foah · Labadi Beach',
    price: '$280',
    rating: '4.6',
    reviews: 42,
    location: 'Accra, Ghana',
    image: 'https://images.unsplash.com/photo-1519501025264-65ba15a82390?w=400&q=80',
  },
  {
    title: 'Eastern Region Adventure & Waterfalls',
    days: '3 days',
    accommodation: 'Mountain Lodge',
    highlights: 'Boti Falls · Aburi Gardens · Shai Hills',
    price: '$265',
    rating: '4.7',
    reviews: 16,
    location: 'Eastern Region, Ghana',
    image: 'https://images.unsplash.com/photo-1441974231531-c6227db76b6e?w=400&q=80',
  },
  {
    title: 'Western Region Rainforest & Beach Combo',
    days: '5 days',
    accommodation: 'Beach Resort',
    highlights: 'Nzulezu · Busua · Rainforest canopy',
    price: '$580',
    rating: '4.8',
    reviews: 25,
    location: 'Western Region, Ghana',
    image: 'https://images.unsplash.com/photo-1500375592092-40eb2168fd21?w=400&q=80',
  },
  {
    title: 'Ghana Discovery Grand Tour',
    days: '10 days',
    accommodation: 'Mixed (Hotel/Lodge)',
    highlights: 'Full Ghana circuit · All regions',
    price: '$1,150',
    rating: '4.9',
    reviews: 14,
    location: 'Ghana',
    image: 'https://images.unsplash.com/photo-1528127269322-539801943592?w=400&q=80',
  },
  {
    title: 'Mole & Savannah Wildlife Safari',
    days: '4 days',
    accommodation: 'Safari Lodge',
    highlights: 'Mole Park · Game drives · Walking safaris',
    price: '$490',
    rating: '4.9',
    reviews: 31,
    location: 'Northern Region, Ghana',
    image: 'https://images.unsplash.com/photo-1583417319070-4a69db38a482?w=400&q=80',
  },
  {
    title: 'Central Region Castles & Rainforest',
    days: '3 days',
    accommodation: 'Eco Resort',
    highlights: 'Kakum Park · Cape Coast Castle · Canopy walk',
    price: '$340',
    rating: '4.7',
    reviews: 38,
    location: 'Central Region, Ghana',
    image: 'https://images.unsplash.com/photo-1516426122078-c23e76319801?w=400&q=80',
  },
  {
    title: 'Ghana Discovery: Coast, Culture & Wildlife',
    days: '7 days',
    accommodation: 'Hotels & Lodges',
    highlights: 'Cape Coast · Kakum · Kumasi · Mole Park',
    price: '$950',
    rating: '4.9',
    reviews: 45,
    location: 'Ghana',
    image: 'https://images.unsplash.com/photo-1583417319070-4a69db38a482?w=400&q=80',
  },
  {
    title: 'Eastern Region Waterfalls & Mountain Hike',
    days: '3 days',
    accommodation: 'Eco Lodge',
    highlights: 'Boti Falls · Akwapim Ridge · Tetteh Quarshie',
    price: '$280',
    rating: '4.7',
    reviews: 22,
    location: 'Eastern Region, Ghana',
    image: 'https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?w=400&q=80',
  },
  {
    title: 'Mole National Park Safari & Wildlife Experience',
    days: '2 days',
    accommodation: 'Safari Lodge',
    highlights: 'Game drives · Wildlife · Nature walks',
    price: '$180',
    rating: '4.8',
    reviews: 19,
    location: 'Northern Region, Ghana',
    image: 'https://images.unsplash.com/photo-1549366021-9f761d450615?w=400&q=80',
    languages: ['English'],
    source: 'travio-ghana',
    externalUrl: 'https://travioghana.com/tour/mole-national-park',
  },
]

const travioTours: Tour[] = [
  {
    title: 'Accra City Highlights & Local Market Tour',
    category: 'Accra · Guided tour',
    duration: '4 hours',
    features: 'Guide · Tastings · Hotel pickup',
    price: '$65',
    rating: '4.7',
    reviews: 34,
    location: 'Accra, Ghana',
    image: 'https://images.unsplash.com/photo-1590868169155-f1a0c43106ef?w=400&q=80',
    languages: ['English'],
    source: 'travio-ghana',
    externalUrl: 'https://travioghana.com/tour/accra-city-highlights',
  },
  {
    title: 'Kumasi Cultural Walk & Ashanti Heritage Tour',
    category: 'Kumasi · Cultural',
    duration: '6 hours',
    features: 'Guide · Entry fees · Lunch',
    price: '$55',
    rating: '4.9',
    reviews: 28,
    location: 'Kumasi, Ghana',
    image: 'https://images.unsplash.com/photo-1516426122078-c23e76319801?w=400&q=80',
    languages: ['English', 'French'],
    source: 'travio-ghana',
    externalUrl: 'https://travioghana.com/tour/kumasi-cultural-walk',
  },
  {
    title: 'Mole National Park Safari & Wildlife Experience',
    category: 'Northern · Safari',
    duration: '2 days',
    features: 'Guide · Accommodation · Meals',
    price: '$180',
    rating: '4.8',
    reviews: 19,
    location: 'Northern Region, Ghana',
    image: 'https://images.unsplash.com/photo-1549366021-9f761d450615?w=400&q=80',
    languages: ['English'],
    source: 'travio-ghana',
    externalUrl: 'https://travioghana.com/tour/mole-national-park',
  },
  {
    title: 'Ada Foah Water Sports & Boat Cruise',
    category: 'Greater Accra · Adventure',
    duration: 'Full day',
    features: 'Lunch · Drinks · Equipment',
    price: '$75',
    rating: '4.6',
    reviews: 42,
    location: 'Ada Foah, Ghana',
    image: 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=400&q=80',
    languages: ['English'],
    source: 'travio-ghana',
    externalUrl: 'https://travioghana.com/tour/ada-foah-cruise',
  },
  {
    title: 'Volta Region Waterfalls & Scenic Hike',
    category: 'Volta · Nature',
    duration: '8 hours',
    features: 'Guide · Lunch · Park fees',
    price: '$60',
    rating: '4.7',
    reviews: 15,
    location: 'Volta Region, Ghana',
    image: 'https://images.unsplash.com/photo-1441974231531-c6227db76b6e?w=400&q=80',
    languages: ['English', 'French'],
    source: 'travio-ghana',
    externalUrl: 'https://travioghana.com/tour/volta-waterfalls',
  },
]

export interface Review {
  name: string
  avatar: string
  rating: number
  date: string
  text: string
  location: string
}

const reviews: Review[] = [
  {
    name: 'Sarah Mitchell',
    avatar: 'SM',
    rating: 5,
    date: 'March 2026',
    text: 'Incredible Kakum Canopy Walk! Our guide Kwame made everyone feel safe. Delicious local lunch included. Highly recommend!',
    location: 'Accra, Ghana',
  },
  {
    name: 'James Thompson',
    avatar: 'JT',
    rating: 5,
    date: 'February 2026',
    text: 'Deeply moving Cape Coast Castle tour. Our guide explained the history with clarity and respect. A must-do in Ghana.',
    location: 'London, UK',
  },
  {
    name: 'Maria Gonzalez',
    avatar: 'MG',
    rating: 5,
    date: 'January 2026',
    text: 'Mole National Park safari exceeded expectations! Saw elephants and monkeys up close. Comfortable lodge and welcoming staff.',
    location: 'Madrid, Spain',
  },
  {
    name: 'David Chen',
    avatar: 'DC',
    rating: 4,
    date: 'December 2025',
    text: 'Great Accra city tour — markets, museums, and the best jollof rice I\'ve ever had. Our guide went above and beyond to show us around.',
    location: 'Singapore',
  },
  {
    name: 'Emily Watson',
    avatar: 'EW',
    rating: 5,
    date: 'November 2025',
    text: 'Boti Falls hike was challenging but rewarding! Swimming at the base of the falls was magical. Great insights about local plants and wildlife.',
    location: 'Melbourne, Australia',
  },
  {
    name: 'Olivia Adams',
    avatar: 'OA',
    rating: 5,
    date: 'October 2025',
    text: 'Jamestown walking tour was the highlight! Street art, lighthouse views, and food stops were perfectly curated. Felt like the real Accra.',
    location: 'New York, USA',
  },
  {
    name: 'Lucas Muller',
    avatar: 'LM',
    rating: 4,
    date: 'September 2025',
    text: 'Very educational Elmina Castle tour. Walking through the Door of No Return is unforgettable. The fishing village portion added a nice contrast.',
    location: 'Berlin, Germany',
  },
  {
    name: 'Aisha Patel',
    avatar: 'AP',
    rating: 5,
    date: 'August 2025',
    text: 'Lake Volta sunset cruise was pure magic! Golden sky, calm waters, and fresh seafood dinner. Perfect for couples or solo travellers.',
    location: 'Mumbai, India',
  },
  {
    name: 'Ryan O\'Brien',
    avatar: 'RO',
    rating: 5,
    date: 'July 2025',
    text: 'Fascinating Kumasi and Ashanti Kingdom tour. The craft villages and Kejetia Market were incredible. Ghanaian hospitality is unmatched!',
    location: 'Dublin, Ireland',
  },
  {
    name: 'Sophie Laurent',
    avatar: 'SL',
    rating: 5,
    date: 'June 2025',
    text: 'Ada Foah beach escape was exactly what I needed. Pristine beach, great food, and a bonus river cruise. Perfect way to unwind after touring.',
    location: 'Paris, France',
  },
]

export interface TravelStory {
  title: string
  excerpt: string
  image: string
  author: string
  date: string
  link: string
}

const travelStories: TravelStory[] = [
  {
    title: 'Exploring the Canopy: A Guide to Kakum National Park',
    excerpt: 'Walk among the treetops on one of Africa\'s most exhilarating canopy walkways. Our guide takes you through everything you need to know before visiting this natural wonder.',
    image: 'https://images.unsplash.com/photo-1580651315530-69c8e0026377?w=600&q=80',
    author: 'Travio Ghana Team',
    date: 'June 12, 2026',
    link: '#',
  },
  {
    title: 'The History and Heritage of Cape Coast Castle',
    excerpt: 'Delve into the profound history of Cape Coast Castle, a UNESCO World Heritage site that stands as a powerful reminder of Ghana\'s past and its journey forward.',
    image: 'https://images.unsplash.com/photo-1599940824399-b87987ceb72a?w=600&q=80',
    author: 'Kwame Asante',
    date: 'May 28, 2026',
    link: '#',
  },
  {
    title: 'A Food Lover\'s Guide to Accra',
    excerpt: 'From street-side kenkey to high-end jollof rice, Accra\'s food scene is a vibrant mix of tradition and innovation. Here\'s where to eat and what to try.',
    image: 'https://images.unsplash.com/photo-1565299624946-b28f40a0ae38?w=600&q=80',
    author: 'Ama Serwaa',
    date: 'May 15, 2026',
    link: '#',
  },
  {
    title: 'Wildlife Encounters: Mole National Park Safari',
    excerpt: 'Elephants, antelopes, and monkeys await at Ghana\'s premier wildlife reserve. Plan your safari with our insider tips for the best experience.',
    image: 'https://images.unsplash.com/photo-1547471080-7cc2caa01a7e?w=600&q=80',
    author: 'Travio Ghana Team',
    date: 'April 30, 2026',
    link: '#',
  },
  {
    title: 'The Best Beaches in Ghana for a Weekend Escape',
    excerpt: 'White sands, calm waters, and palm-fringed shores — Ghana\'s coastline has some of West Africa\'s most beautiful beaches. Discover our top picks.',
    image: 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=600&q=80',
    author: 'Nana Yaw',
    date: 'April 18, 2026',
    link: '#',
  },
  {
    title: 'Exploring Ashanti Culture in Kumasi',
    excerpt: 'Immerse yourself in the rich traditions of the Ashanti Kingdom, from goldsmith villages to the magnificent Manhyia Palace.',
    image: 'https://images.unsplash.com/photo-1574169208507-84376144848b?w=600&q=80',
    author: 'Akua Mensah',
    date: 'March 22, 2026',
    link: '#',
  },
]

export function storySlug(title: string): string {
  return title
    .toLowerCase()
    .replace(/['’]/g, '')
    .replace(/&/g, 'and')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
}

export interface TourWithMeta extends Tour {
  section: string
  tourType: 'day' | 'multi-day'
}

export const allTours: TourWithMeta[] = [
  ...dayTours.map(t => ({ ...t, section: 'Day Tours' as const, tourType: 'day' as const, languages: t.languages || ['English'] })),
  ...multiDayTours.map(t => ({
    ...t,
    category: '',
    duration: t.days,
    features: t.highlights,
    section: 'Multi-Day Tours' as const,
    tourType: 'multi-day' as const,
    languages: t.languages || ['English'],
  })),
]

export function parsePrice(price: string): number {
  return parseInt(price.replace(/[$,]/g, ''), 10)
}

export function parseCategory(raw: string): string {
  const parts = raw.split('·')
  return parts.length > 1 ? parts[1].trim() : raw
}

export function getDurationLabel(tour: TourWithMeta): string {
  if (tour.tourType === 'multi-day') {
    return (tour as any).days || tour.duration
  }
  return tour.duration
}

export function getDurationHours(tour: TourWithMeta): number {
  const dur = getDurationLabel(tour)
  if (tour.tourType === 'multi-day') {
    const num = parseInt(dur)
    return isNaN(num) ? 0 : num * 24
  }
  const num = parseInt(dur)
  if (!isNaN(num)) return num
  if (dur === 'Half day') return 4
  if (dur === 'Full day') return 8
  return 0
}

export const durationBuckets = [
  { value: 'under-4', label: '< 4 hours', match: (h: number) => h > 0 && h < 4 },
  { value: '4-6', label: '4–6 hours', match: (h: number) => h >= 4 && h <= 6 },
  { value: 'full-day', label: 'Full Day (6+)', match: (h: number) => h > 6 && h < 24 },
  { value: '2-3-days', label: '2–3 Days', match: (h: number) => h >= 48 && h <= 72 },
  { value: '4-plus-days', label: '4+ Days', match: (h: number) => h > 72 },
]

export const priceRanges = [
  { value: 'under-50', label: 'Under $50', match: (p: number) => p < 50 },
  { value: '50-100', label: '$50 – $100', match: (p: number) => p >= 50 && p <= 100 },
  { value: '100-200', label: '$100 – $200', match: (p: number) => p > 100 && p <= 200 },
  { value: 'over-200', label: '$200+', match: (p: number) => p > 200 },
]

export { dayTours, multiDayTours, travioTours, reviews, travelStories }
