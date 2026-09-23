/**
 * Partner application form configuration.
 * Each partner type defines its own steps, fields, validation, and initial state.
 */
import { Building2, Briefcase, FileText, UserCircle, ShieldCheck, Car, Camera, Hotel, Handshake, MapPin } from "lucide-react"

export type PartnerType = "tour-operators" | "hotels" | "travel-agents" | "content-creators" | "transport-providers"

export interface StepDef {
  key: string
  label: string
  icon: typeof Building2
}

export interface PartnerFormConfig {
  title: string
  subtitle: string
  steps: StepDef[]
  initialForm: Record<string, any>
  validateStep: (stepKey: string, form: Record<string, any>) => string | null
}

/* ---------- Shared field types ---------- */

export interface BasicInfoFields {
  fullName: string
  email: string
  phoneCode: string
  phoneNumber: string
  location: string
}

export interface ReviewFields {
  termsAccepted: boolean
}

/* ---------- Tour Operators ---------- */

const tourOperatorsSteps: StepDef[] = [
  { key: "business", label: "Business Info", icon: Building2 },
  { key: "operating", label: "Operating Info", icon: Briefcase },
  { key: "representative", label: "Representative", icon: UserCircle },
  { key: "documents", label: "Documents", icon: FileText },
  { key: "compliance", label: "Review & Submit", icon: ShieldCheck },
]

/* ---------- Hotels ---------- */

const hotelsSteps: StepDef[] = [
  { key: "basic", label: "Basic Information", icon: UserCircle },
  { key: "property", label: "Property Details", icon: Hotel },
  { key: "location", label: "Location & Contact", icon: MapPin },
  { key: "documents", label: "Required Documents", icon: FileText },
  { key: "review", label: "Review & Submit", icon: ShieldCheck },
]

/* ---------- Travel Agents ---------- */

const travelAgentsSteps: StepDef[] = [
  { key: "basic", label: "Basic Information", icon: UserCircle },
  { key: "agency", label: "Agency Details", icon: Building2 },
  { key: "channels", label: "Sales Channels", icon: Briefcase },
  { key: "documents", label: "Required Documents", icon: FileText },
  { key: "review", label: "Review & Submit", icon: ShieldCheck },
]

/* ---------- Content Creators ---------- */

const contentCreatorsSteps: StepDef[] = [
  { key: "basic", label: "Basic Information", icon: UserCircle },
  { key: "identity", label: "Creator Identity", icon: Camera },
  { key: "socials", label: "Socials & Content", icon: Briefcase },
  { key: "interests", label: "Collaboration Interests", icon: Handshake },
  { key: "review", label: "Review & Submit", icon: ShieldCheck },
]

/* ---------- Transport Providers ---------- */

const transportProvidersSteps: StepDef[] = [
  { key: "basic", label: "Basic Information", icon: UserCircle },
  { key: "fleet", label: "Fleet Details", icon: Car },
  { key: "areas", label: "Service Areas", icon: MapPin },
  { key: "documents", label: "Required Documents", icon: FileText },
  { key: "review", label: "Review & Submit", icon: ShieldCheck },
]

/* ---------- Initial form states ---------- */

function createBasicInitial(): BasicInfoFields {
  return { fullName: "", email: "", phoneCode: "+233", phoneNumber: "", location: "" }
}

const TOUR_INITIAL = {
  // Supplier Type step
  supplierType: "",
  // Business Info step
  legalName: "",
  displayName: "",
  businessType: "",
  country: "",
  fullAddress: "",
  phone: "",
  website: "",
  // Operating Info step
  tourCategories: [] as string[],
  destinations: [] as string[],
  languages: [] as string[],
  yearsInBusiness: "",
  meetingStyle: "",
  cancellationPolicy: "",
  // Representative step
  repFullName: "",
  repEmail: "",
  repDateOfBirth: "",
  repIdType: "",
  repFullAddress: "",
  // Documents step
  businessLicense: null as File | null,
  identityDoc: null as File | null,
  proofOfAddress: null as File | null,
  // Compliance step
  termsAccepted: false,
}

const HOTEL_INITIAL = {
  ...createBasicInitial(),
  propertyName: "",
  starRating: "",
  numberOfRooms: "",
  amenities: [] as string[],
  fullAddress: "",
  gpsCoordinates: "",
  frontDeskPhone: "",
  checkInTime: "",
  checkOutTime: "",
  businessLicense: null as File | null,
  healthCertificate: null as File | null,
  fireSafetyCert: null as File | null,
  termsAccepted: false,
}

const TRAVEL_AGENT_INITIAL = {
  ...createBasicInitial(),
  agencyName: "",
  licenseNumber: "",
  yearsInBusiness: "",
  marketsServed: [] as string[],
  onlinePlatforms: "",
  retailLocations: "",
  commissionStructure: "",
  businessLicense: null as File | null,
  businessRegistration: null as File | null,
  proofOfAddress: null as File | null,
  termsAccepted: false,
}

const CONTENT_CREATOR_INITIAL = {
  ...createBasicInitial(),
  displayName: "",
  contentNiche: "",
  audienceSize: "",
  socialLinks: {} as Record<string, string>,
  contentType: [] as string[],
  portfolioUrl: "",
  preferredCampaigns: [] as string[],
  availability: "",
  rateExpectations: "",
  termsAccepted: false,
}

const TRANSPORT_INITIAL = {
  ...createBasicInitial(),
  vehicleTypes: [] as string[],
  fleetSize: "",
  passengerCapacity: "",
  primaryRoutes: "",
  coverageRegions: [] as string[],
  pricingModel: "",
  vehicleRegistration: null as File | null,
  insurance: null as File | null,
  driverLicense: null as File | null,
  roadworthinessCert: null as File | null,
  termsAccepted: false,
}

/* ---------- Validation helpers ---------- */

function validateBasic(form: Record<string, any>): string | null {
  if (!form.fullName?.trim()) return "Full name is required"
  if (!form.email?.trim()) return "Email is required"
  if (!form.phoneNumber?.trim()) return "Phone number is required"
  if (!form.location?.trim()) return "Location is required"
  return null
}

function validateReview(form: Record<string, any>): string | null {
  if (!form.termsAccepted) return "You must accept the terms to submit"
  return null
}

/* ---------- Config map ---------- */

const configs: Record<PartnerType, PartnerFormConfig> = {
  "tour-operators": {
    title: "Tour Operator Application",
    subtitle: "List your experiences on Travio Ghana and reach travellers ready to book.",
    steps: tourOperatorsSteps,
    initialForm: TOUR_INITIAL,
    validateStep(stepKey, form) {
      switch (stepKey) {
        case "business":
          if (!form.legalName?.trim()) return "Legal business name is required"
          if (!form.displayName?.trim()) return "Display name is required"
          if (!form.businessType) return "Business type is required"
          if (!form.country) return "Country is required"
          if (!form.fullAddress?.trim()) return "Full address is required"
          if (!form.phone?.trim()) return "Phone number is required"
          return null
        case "operating":
          if (!form.tourCategories?.length) return "Select at least one tour category"
          if (!form.destinations?.length) return "Select at least one destination"
          return null
        case "representative":
          if (!form.repFullName?.trim()) return "Representative name is required"
          if (!form.repEmail?.trim()) return "Representative email is required"
          return null
        case "documents":
          if (!form.identityDoc) return "Identity document is required"
          return null
        case "compliance": return validateReview(form)
        default: return null
      }
    },
  },

  "hotels": {
    title: "Hotel & Accommodation Application",
    subtitle: "Offer your guests exclusive experiences and earn through every successful booking.",
    steps: hotelsSteps,
    initialForm: HOTEL_INITIAL,
    validateStep(stepKey, form) {
      switch (stepKey) {
        case "basic": return validateBasic(form)
        case "property":
          if (!form.propertyName?.trim()) return "Property name is required"
          if (!form.starRating) return "Star rating is required"
          return null
        case "location":
          if (!form.fullAddress?.trim()) return "Full address is required"
          return null
        case "documents":
          if (!form.businessLicense) return "Business license is required"
          return null
        case "review": return validateReview(form)
        default: return null
      }
    },
  },

  "travel-agents": {
    title: "Travel Agent Application",
    subtitle: "Resell Travio Ghana experiences to your clients with simple, transparent terms.",
    steps: travelAgentsSteps,
    initialForm: TRAVEL_AGENT_INITIAL,
    validateStep(stepKey, form) {
      switch (stepKey) {
        case "basic": return validateBasic(form)
        case "agency":
          if (!form.agencyName?.trim()) return "Agency name is required"
          if (!form.licenseNumber?.trim()) return "License number is required"
          return null
        case "channels":
          if (!form.onlinePlatforms?.trim() && !form.retailLocations?.trim())
            return "Provide at least one sales channel"
          return null
        case "documents":
          if (!form.businessLicense) return "Business license is required"
          return null
        case "review": return validateReview(form)
        default: return null
      }
    },
  },

  "content-creators": {
    title: "Content Creator Application",
    subtitle: "Collaborate with us to create inspiring travel content and earn through your audience.",
    steps: contentCreatorsSteps,
    initialForm: CONTENT_CREATOR_INITIAL,
    validateStep(stepKey, form) {
      switch (stepKey) {
        case "basic": return validateBasic(form)
        case "identity":
          if (!form.displayName?.trim()) return "Display name is required"
          if (!form.contentNiche) return "Content niche is required"
          return null
        case "socials":
          if (!form.socialLinks || Object.values(form.socialLinks).every((v) => typeof v !== "string" || !v.trim()))
            return "Provide at least one social media link"
          return null
        case "interests": return null
        case "review": return validateReview(form)
        default: return null
      }
    },
  },

  "transport-providers": {
    title: "Transport Provider Application",
    subtitle: "Partner with us to offer seamless transport solutions for travellers.",
    steps: transportProvidersSteps,
    initialForm: TRANSPORT_INITIAL,
    validateStep(stepKey, form) {
      switch (stepKey) {
        case "basic": return validateBasic(form)
        case "fleet":
          if (!form.vehicleTypes?.length) return "Select at least one vehicle type"
          if (!form.fleetSize) return "Fleet size is required"
          return null
        case "areas":
          if (!form.primaryRoutes?.trim()) return "Primary routes are required"
          return null
        case "documents":
          if (!form.vehicleRegistration) return "Vehicle registration is required"
          if (!form.insurance) return "Insurance document is required"
          return null
        case "review": return validateReview(form)
        default: return null
      }
    },
  },
}

export function getPartnerFormConfig(type: PartnerType): PartnerFormConfig | null {
  return configs[type] ?? null
}

export const PARTNER_TYPES: { value: PartnerType; label: string }[] = [
  { value: "tour-operators", label: "Tour Operators & Suppliers" },
  { value: "hotels", label: "Hotels & Accommodations" },
  { value: "travel-agents", label: "Travel Agents & Resellers" },
  { value: "content-creators", label: "Content Creators & Influencers" },
  { value: "transport-providers", label: "Transport Providers" },
]

export const PHONE_CODES = [
  { code: "+233", country: "GH", label: "GH +233" },
  { code: "+234", country: "NG", label: "NG +234" },
  { code: "+27", country: "ZA", label: "ZA +27" },
  { code: "+254", country: "KE", label: "KE +254" },
  { code: "+255", country: "TZ", label: "TZ +255" },
  { code: "+1", country: "US", label: "US +1" },
  { code: "+44", country: "GB", label: "GB +44" },
]

export const TOUR_CATEGORIES = [
  "Adventure", "Cultural", "Wildlife Safari", "Beach & Coastal", "Hiking & Trekking",
  "City Tours", "Food & Culinary", "Photography", "Historical", "Eco-Tourism",
]

export const AMENITIES = [
  "WiFi", "Pool", "Spa", "Restaurant", "Bar", "Gym", "Parking", "Airport Shuttle",
  "Room Service", "Laundry", "Conference Room", "Beach Access",
]

export const CONTENT_NICHES = [
  "Travel", "Food & Culinary", "Culture & Heritage", "Adventure", "Luxury",
  "Budget Travel", "Family Travel", "Solo Travel", "Photography", "Sustainability",
]

export const VEHICLE_TYPES = [
  "Sedan", "SUV", "Van", "Minibus", "Bus", "Coaster", "Motorcycle", "4x4",
]

export const COVERAGE_REGIONS = [
  "Greater Accra", "Ashanti", "Western", "Central", "Eastern", "Northern",
  "Volta", "Upper East", "Upper West", "Brong Ahafo",
]

/* ---------- Supplier Form Constants (for Tour Operators) ---------- */

export const SUPPLIER_TYPES_LIST = [
  { value: "tour_guide", label: "Tour Guide" },
  { value: "tour_company", label: "Tour Company" },
  { value: "accommodation", label: "Accommodation Provider" },
  { value: "transport", label: "Transportation Provider" },
  { value: "vehicle_shuttle", label: "Vehicle / Shuttle Operator" },
  { value: "other", label: "Other Tourism Service" },
]

export const COUNTRIES = [
  { code: "GH", name: "Ghana" },
  { code: "NG", name: "Nigeria" },
  { code: "ZA", name: "South Africa" },
  { code: "KE", name: "Kenya" },
  { code: "TZ", name: "Tanzania" },
  { code: "UG", name: "Uganda" },
  { code: "RW", name: "Rwanda" },
  { code: "ET", name: "Ethiopia" },
  { code: "EG", name: "Egypt" },
  { code: "MA", name: "Morocco" },
  { code: "US", name: "United States" },
  { code: "GB", name: "United Kingdom" },
  { code: "OTHER", name: "Other" },
]

export const BUSINESS_TYPES_LIST = [
  { value: "individual", label: "Individual / Sole Proprietor" },
  { value: "company", label: "Company / Corporation" },
  { value: "non_profit", label: "Non-Profit Organization" },
]

export const LANGUAGES = [
  "English", "French", "Swahili", "Arabic", "Spanish", "Portuguese", "German", "Twi", "Ga", "Ewe",
]

export const MEETING_STYLES = [
  { value: "pickup", label: "Pickup from hotel/location" },
  { value: "meeting_point", label: "Meet at designated point" },
  { value: "flexible", label: "Flexible / Both options" },
]

export const CANCELLATION_POLICIES = [
  { value: "flexible", label: "Flexible — Full refund 24h+ before" },
  { value: "moderate", label: "Moderate — Full refund 5+ days before" },
  { value: "strict", label: "Strict — 50% refund 7+ days before" },
  { value: "non_refundable", label: "Non-refundable" },
]

export const ID_TYPES = [
  { value: "passport", label: "Passport" },
  { value: "national_id", label: "National ID Card" },
  { value: "drivers_license", label: "Driver's License" },
]
