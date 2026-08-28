// Supplier Page Type Definitions

export interface SupplierData {
  id: string
  name: string
  logo: string
  description: string
  rating: number
  totalTours: number
  phone: string
  email: string
  website: string
  address: string
  verified: boolean
  features?: string[]
  socialLinks?: {
    facebook?: string
    instagram?: string
    twitter?: string
  }
}

export interface Tour {
  id: string
  title: string
  duration: string
  features: string
  price: string
  rating: number
  reviews: number
  location: string
  image: string
  discount?: string
  supplierId: string
  supplierName: string
}

export interface TrustBadgeProps {
  icon: React.ReactNode
  title: string
  description: string
}

export interface ContactInfo {
  phone: string
  email: string
  website: string
  location: string
}

export type SortOption = 'popular' | 'price-low' | 'price-high' | 'rating'

export interface SortOptionItem {
  value: SortOption
  label: string
}

export interface SupplierHeaderProps {
  logo: string
  name: string
  rating: number
  tourCount: number
  verified: boolean
  saved: boolean
  onSave: () => void
  onContact: () => void
  onBack: () => void
}

export interface AboutSectionProps {
  description: string
  features?: string[]
}

export interface ContactCardProps {
  phone: string
  email: string
  website: string
  location: string
}

export interface ToursSectionProps {
  tours: Tour[]
  totalCount: number
  sortBy: SortOption
  onSortChange: (option: SortOption) => void
  showAll: boolean
  onViewAll: () => void
}
