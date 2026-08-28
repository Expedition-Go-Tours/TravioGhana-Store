/**
 * Multi-step supplier onboarding form (business info, documents, review).
 * Submits to POST /suppliers/apply via lib/supplier.ts.
 *
 * @see lib/supplier.ts
 * @see pages/supplier/SupplierRegisterPage.tsx
 */
import { useState, useCallback, useEffect, useMemo, useRef } from "react"
import { useTranslation } from "react-i18next"
import { useNavigate } from "react-router-dom"
import { motion, AnimatePresence } from "framer-motion"
import {
  AlertCircle,
  Building2,
  Briefcase,
  UserCircle,
  FileText,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  LoaderCircle,
  Globe,
  Phone,
  MapPin,
  Link as LinkIcon,
  ShieldCheck,
  BadgeCheck,
  Upload,
  X,
  Car,
  Plus,
  Trash2,
} from "lucide-react"

import { Button } from "@/components/ui/button"
import { DatePicker } from "@/components/ui/date-picker"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { applyAsSupplier, SUPPLIER_TYPES, supplierTypeLabel, documentRequirementsFor, VEHICLE_DOC_TYPES, GUIDE_DOC_TYPES, documentTypeLabel } from "@/lib/supplier"
import { getAuthUserId } from "@/lib/auth"
import { useAuthUser } from "@/hooks/useAuthUser"
import GhanaDestinationSelect from "@/components/supplier/GhanaDestinationSelect"
import { filterLanguagesForCountry, getLanguagesForCountry } from "@/lib/countryLanguages"
import {
  clearSupplierApplicationDraft,
  createEmptySupplierApplicationForm,
  loadSupplierApplicationDraft,
  mergeSupplierApplicationDraft,
  migrateAnonymousDraftToUser,
  rememberDraftUserId,
  resolveDraftUserId,
  saveSupplierApplicationDraft,
  type SupplierApplicationForm,
} from "@/lib/supplierApplicationDraft"

const STEPS = [
  { key: "type", label: "Supplier Type", icon: BadgeCheck },
  { key: "business", label: "Business Info", icon: Building2 },
  { key: "operating", label: "Operating Info", icon: Briefcase },
  { key: "representative", label: "Representative", icon: UserCircle },
  { key: "documents", label: "Documents", icon: FileText },
  { key: "compliance", label: "Review & Submit", icon: ShieldCheck },
] as const

type StepKey = (typeof STEPS)[number]["key"]

const BUSINESS_TYPES = [
  { value: "individual", label: "Individual / Sole Proprietor" },
  { value: "company", label: "Company / Corporation" },
  { value: "non_profit", label: "Non-Profit Organization" },
]

const COUNTRIES = [
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
  { code: "DE", name: "Germany" },
  { code: "FR", name: "France" },
  { code: "NL", name: "Netherlands" },
  { code: "ES", name: "Spain" },
  { code: "IT", name: "Italy" },
  { code: "CA", name: "Canada" },
  { code: "AU", name: "Australia" },
  { code: "OTHER", name: "Other" },
]

const ID_TYPES = [
  { value: "passport", label: "Passport" },
  { value: "national_id", label: "National ID Card" },
  { value: "drivers_license", label: "Driver's License" },
]

const MEETING_STYLES = [
  { value: "pickup", label: "Pickup from hotel/location" },
  { value: "meeting_point", label: "Meet at designated point" },
  { value: "flexible", label: "Flexible / Both options" },
]

const CANCELLATION_POLICY_OPTIONS = [
  {
    value: "individual",
    label: "Individual Tour Bookings",
    text: `Individual Tour Bookings

More than 30 days before departure:
You will receive a full refund, minus a 10% administrative fee.

15-30 days before departure:
You will receive a 50% refund, minus any non-refundable costs we've incurred (e.g., accommodation deposits, permits, etc.).

Less than 1 day before departure:
No refund will be provided. However, we may offer you the option to reschedule your tour to another date, subject to availability.`,
  },
  {
    value: "group",
    label: "Group Bookings (10 or more participants)",
    text: `Group Bookings (10 or more participants)

More than 60 days before departure:
Full refund, minus a 10% group booking fee.

30-60 days before departure:
75% of your total booking cost will be refunded.

Less than 30 days before departure:
Unfortunately, we cannot offer a refund, but we will try to accommodate rescheduling if possible.`,
  },
]

function getCancellationPolicyText(policyKey: string): string {
  const option = CANCELLATION_POLICY_OPTIONS.find((p) => p.value === policyKey)
  return option?.text || ""
}

function getCancellationPolicyLabel(policyKey: string): string {
  const option = CANCELLATION_POLICY_OPTIONS.find((p) => p.value === policyKey)
  return option?.label || ""
}

const TOUR_CATEGORIES_OPTIONS = [
  "Adventure",
  "Cultural",
  "Nature",
  "Wildlife",
  "Historical",
  "Food & Culinary",
  "Photography",
  "Beach & Water",
  "City Tours",
  "Mountain & Hiking",
  "Luxury",
  "Family Friendly",
]

function getStepValidationError(stepKey: StepKey, form: SupplierApplicationForm): string | null {
  if (stepKey === "type") {
    if (!form.supplierType) return "Select the type of supplier you are"
  }

  if (stepKey === "business") {
    const b = form.businessInfo
    if (!b.legalBusinessName.trim()) return "Legal business name is required"
    if (!b.displayName.trim()) return "Display name is required"
    if (!b.businessType) return "Business type is required"
    if (!b.country) return "Country is required"
    if (!b.address.line1.trim()) return "Address line 1 is required"
    if (!b.address.city.trim()) return "City is required"
    if (!b.address.state.trim()) return "State / Province is required"
    if (!b.address.postalCode.trim()) return "Postal code is required"
    if (!b.phoneNumber.trim()) return "Phone number is required"
  }

  if (stepKey === "operating") {
    const o = form.operatingInfo
    if (o.tourCategories.length === 0) return "Select at least one tour category"
    if (o.destinations.length === 0) return "Add at least one destination"
    if (o.languages.length === 0) return "Select at least one language"
    if (!o.yearsInBusiness || parseInt(o.yearsInBusiness, 10) < 0)
      return "Years in business is required"
    if (!getCancellationPolicyText(o.cancellationPolicy)) return "Cancellation policy is required"
    if (!o.meetingStyle) return "Meeting style is required"
  }

  if (stepKey === "representative") {
    const r = form.representativeInfo
    if (!r.fullName.trim()) return "Representative full name is required"
    if (!r.email.trim()) return "Representative email is required"
    if (!r.dateOfBirth) return "Date of birth is required"
    if (!r.address.line1.trim()) return "Representative address line 1 is required"
    if (!r.address.city.trim()) return "Representative city is required"
    if (!r.address.state.trim()) return "Representative state / province is required"
    if (!r.address.postalCode.trim()) return "Representative postal code is required"
    if (!r.idType) return "ID type is required"
  }

  if (stepKey === "documents") {
    const required = documentRequirementsFor(form.supplierType, form.businessInfo.country)
    const docs = form.verificationDocuments.filter((d) => d.ownerType === "SUPPLIER")
    const uploadedTypes = new Set(docs.filter((d) => d.file).map((d) => d.type))
    for (const reqType of required) {
      if (!uploadedTypes.has(reqType)) return `${documentTypeLabel(reqType)} is required`
    }

    const wantsVehicles =
      form.supplierType === "TRANSPORTATION_PROVIDER" || form.supplierType === "VEHICLE_OPERATOR"
    if (wantsVehicles && form.vehicles.length === 0) {
      return "Add at least one vehicle with its documents"
    }
    for (const v of form.vehicles) {
      if (!v.make.trim() || !v.model.trim() || !v.registrationNumber.trim()) {
        return "Every vehicle needs a make, model and registration number"
      }
      for (const dt of VEHICLE_DOC_TYPES) {
        const has = form.verificationDocuments.some(
          (d) => d.ownerType === "VEHICLE" && d.ownerKey === v.key && d.type === dt.type && d.file
        )
        if (!has) return `Add ${dt.label} for ${v.make} ${v.model}`
      }
    }

    if (form.supplierType === "TOUR_COMPANY") {
      for (const g of form.guides) {
        if (!g.fullName.trim()) return "Every guide needs a full name"
        for (const dt of GUIDE_DOC_TYPES) {
          const has = form.verificationDocuments.some(
            (d) => d.ownerType === "GUIDE" && d.ownerKey === g.key && d.type === dt.type && d.file
          )
          if (!has) return `Add ${dt.label} for ${g.fullName}`
        }
      }
    }
  }

  if (stepKey === "compliance") {
    if (!form.compliance.acceptedTerms) return "You must accept the terms and conditions"
  }

  return null
}

const STEP_FIELDS: Record<StepKey, { path: string; message: string }[]> = {
  type: [{ path: "supplierType", message: "Select the type of supplier you are" }],
  business: [
    { path: "businessInfo.legalBusinessName", message: "Legal business name is required" },
    { path: "businessInfo.displayName", message: "Display name is required" },
    { path: "businessInfo.businessType", message: "Business type is required" },
    { path: "businessInfo.country", message: "Country is required" },
    { path: "businessInfo.address.line1", message: "Address line 1 is required" },
    { path: "businessInfo.address.city", message: "City is required" },
    { path: "businessInfo.address.state", message: "State / Province is required" },
    { path: "businessInfo.address.postalCode", message: "Postal code is required" },
    { path: "businessInfo.phoneNumber", message: "Phone number is required" },
  ],
  operating: [
    { path: "operatingInfo.tourCategories", message: "Select at least one tour category" },
    { path: "operatingInfo.destinations", message: "Add at least one destination" },
    { path: "operatingInfo.languages", message: "Select at least one language" },
    { path: "operatingInfo.yearsInBusiness", message: "Years in business is required" },
    { path: "operatingInfo.cancellationPolicy", message: "Cancellation policy is required" },
    { path: "operatingInfo.meetingStyle", message: "Meeting style is required" },
  ],
  representative: [
    { path: "representativeInfo.fullName", message: "Representative full name is required" },
    { path: "representativeInfo.email", message: "Representative email is required" },
    { path: "representativeInfo.dateOfBirth", message: "Date of birth is required" },
    { path: "representativeInfo.address.line1", message: "Representative address line 1 is required" },
    { path: "representativeInfo.address.city", message: "Representative city is required" },
    { path: "representativeInfo.address.state", message: "Representative state / province is required" },
    { path: "representativeInfo.address.postalCode", message: "Representative postal code is required" },
    { path: "representativeInfo.idType", message: "ID type is required" },
  ],
  documents: [
    { path: "verificationDocuments", message: "Upload all required documents" },
  ],
  compliance: [
    { path: "compliance.acceptedTerms", message: "You must accept the terms and conditions" },
  ],
}

function getFieldErrors(stepKey: StepKey, form: SupplierApplicationForm): Record<string, string> {
  const fields = STEP_FIELDS[stepKey] || []
  const errors: Record<string, string> = {}

  for (const { path, message } of fields) {
    const parts = path.split(".")
    let value: unknown = form
    for (const part of parts) {
      if (value == null || typeof value !== "object") {
        value = undefined
        break
      }
      value = (value as Record<string, unknown>)[part]
    }

    const isEmpty =
      value === undefined ||
      value === null ||
      (typeof value === "string" && !value.trim()) ||
      (Array.isArray(value) && value.length === 0) ||
      (typeof value === "boolean" && !value)

    if (isEmpty) {
      errors[path] = message
    }
  }

  return errors
}

function FieldError({ message }: { message?: string }) {
  if (!message) return null
  return (
    <p className="mt-1.5 flex items-center gap-1 text-xs font-medium text-rose-500" role="alert">
      <AlertCircle className="size-3 shrink-0" />
      <span>{message}</span>
    </p>
  )
}

function StepIndicator({
  steps,
  currentStep,
  onStepClick,
  stepCompleted = [],
}: {
  steps: typeof STEPS
  currentStep: number
  onStepClick?: (idx: number) => void
  stepCompleted?: boolean[]
}) {
  return (
    <div className="mb-8 overflow-x-auto px-4">
      <div className="flex min-w-[280px] items-center justify-center sm:min-w-0 sm:justify-between">
        {steps.map((step, idx) => {
          const isActive = idx === currentStep
          const isCompleted = Boolean(stepCompleted[idx])
          const isLast = idx === steps.length - 1

          return (
            <div key={step.key} className="flex flex-1 items-center">
              <button
                type="button"
                onClick={() => onStepClick?.(idx)}
                aria-current={isActive ? "step" : undefined}
                aria-label={`${step.label}${isCompleted ? ", completed" : ""}`}
                className="flex flex-col items-center gap-2 rounded-lg transition-opacity hover:opacity-80 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
              >
                <div
                  className={`flex size-8 items-center justify-center rounded-full border-2 sm:size-10 ${
                    isActive
                      ? "border-primary bg-primary text-white shadow-lg"
                      : isCompleted
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-slate-200 bg-white text-slate-400"
                  }`}
                >
                  {isCompleted && !isActive ? (
                    <CheckCircle2 className="size-4 sm:size-5" />
                  ) : (
                    <step.icon className="size-3.5 sm:size-4" />
                  )}
                </div>
                <span
                  className={`hidden text-xs font-semibold sm:block ${
                    isActive
                      ? "text-primary"
                      : isCompleted
                        ? "text-slate-700"
                        : "text-slate-400"
                  }`}
                >
                  {step.label}
                </span>
              </button>
              {!isLast && (
                <div
                  className={`mx-1.5 h-px flex-1 sm:mx-4 ${
                    isCompleted ? "bg-primary" : "bg-slate-200"
                  }`}
                />
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

function FieldLabel({ children, required }: { children: React.ReactNode; required?: boolean }) {
  return (
    <label className="mb-1.5 block text-sm font-semibold text-slate-700">
      {children}
      {required && <span className="ml-1 text-rose-500">*</span>}
    </label>
  )
}

function FormSection({
  title,
  description,
  children,
}: {
  title: string
  description?: string
  children: React.ReactNode
}) {
  return (
    <div className="space-y-5">
      <div className="border-b border-slate-100 pb-4">
        <h3 className="text-lg font-bold text-slate-900">{title}</h3>
        {description && <p className="mt-1 text-sm text-slate-500">{description}</p>}
      </div>
      <div className="space-y-5">{children}</div>
    </div>
  )
}

function filePreviewKey(file: File): string {
  return `${file.name}-${file.size}-${file.lastModified}`
}

function ImageUploadField({
  label,
  file,
  onChange,
  required,
}: {
  label: string
  file: File | null
  onChange: (file: File | null) => void
  required?: boolean
}) {
  const [preview, setPreview] = useState<string | null>(null)

  useEffect(() => {
    if (!file) {
      window.setTimeout(() => setPreview(null), 0)
      return
    }
    const url = URL.createObjectURL(file)
    window.setTimeout(() => setPreview(url), 0)
    return () => URL.revokeObjectURL(url)
  }, [file])

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0]
    if (selected) onChange(selected)
  }

  return (
    <div>
      <FieldLabel required={required}>{label}</FieldLabel>
      {preview ? (
        <div className="relative overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <img src={preview} alt={label} className="h-48 w-full object-contain" />
          <button
            type="button"
            onClick={() => onChange(null)}
            className="absolute right-3 top-3 flex size-8 items-center justify-center rounded-full bg-white/90 text-slate-600 shadow-md transition hover:bg-white hover:text-rose-600"
          >
            <X className="size-4" />
          </button>
          <p className="truncate px-4 pb-3 text-center text-xs text-slate-500">{file?.name}</p>
        </div>
      ) : (
        <label className="flex cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed border-slate-300 bg-slate-50 px-6 py-10 transition hover:border-primary/50 hover:bg-primary/5">
          <Upload className="mb-2 size-8 text-slate-400" />
          <span className="text-sm font-semibold text-slate-700">Click to upload an image</span>
          <span className="mt-1 text-xs text-slate-400">PNG, JPG, JPEG up to 5MB</span>
          <input
            type="file"
            accept="image/png,image/jpeg,image/jpg"
            className="sr-only"
            onChange={handleFileChange}
          />
        </label>
      )}
    </div>
  )
}

function MultiImageUploadField({
  label,
  files,
  onChange,
  required,
}: {
  label: string
  files: File[]
  onChange: (files: File[]) => void
  required?: boolean
}) {
  const [previews, setPreviews] = useState<{ key: string; url: string; name: string }[]>([])

  useEffect(() => {
    const next = files.map((file) => ({
      key: filePreviewKey(file),
      url: URL.createObjectURL(file),
      name: file.name,
    }))
    window.setTimeout(() => setPreviews(next), 0)
    return () => next.forEach((item) => URL.revokeObjectURL(item.url))
  }, [files])

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = Array.from(e.target.files || [])
    if (selected.length) onChange([...files, ...selected])
  }

  const removeFile = (index: number) => {
    onChange(files.filter((_, i) => i !== index))
  }

  return (
    <div>
      <FieldLabel required={required}>{label}</FieldLabel>
      <div className="space-y-3">
        {previews.length > 0 && (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {previews.map((item, index) => (
              <div
                key={item.key}
                className="relative overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm"
              >
                <img src={item.url} alt={item.name} className="h-32 w-full object-cover" />
                <button
                  type="button"
                  onClick={() => removeFile(index)}
                  className="absolute right-2 top-2 flex size-7 items-center justify-center rounded-full bg-white/90 text-slate-600 shadow-md transition hover:bg-white hover:text-rose-600"
                >
                  <X className="size-3.5" />
                </button>
                <p className="truncate px-3 pb-2 text-center text-[10px] text-slate-500">
                  {item.name}
                </p>
              </div>
            ))}
          </div>
        )}
        <label className="flex cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed border-slate-300 bg-slate-50 px-6 py-8 transition hover:border-primary/50 hover:bg-primary/5">
          <Upload className="mb-2 size-7 text-slate-400" />
          <span className="text-sm font-semibold text-slate-700">
            Click to upload license images
          </span>
          <span className="mt-1 text-xs text-slate-400">PNG, JPG, JPEG up to 5MB each</span>
          <input
            type="file"
            multiple
            accept="image/png,image/jpeg,image/jpg"
            className="sr-only"
            onChange={handleFileChange}
          />
        </label>
      </div>
    </div>
  )
}

function MultiSelect({
  label,
  options,
  selected,
  onChange,
  required,
}: {
  label: string
  options: string[]
  selected: string[]
  onChange: (value: string[]) => void
  required?: boolean
}) {
  const toggleOption = useCallback(
    (option: string) => {
      if (selected.includes(option)) {
        onChange(selected.filter((s) => s !== option))
      } else {
        onChange([...selected, option])
      }
    },
    [selected, onChange]
  )

  return (
    <div>
      <FieldLabel required={required}>{label}</FieldLabel>
      <div className="flex flex-wrap gap-2">
        {options.map((option) => {
          const isSelected = selected.includes(option)
          return (
            <button
              key={option}
              type="button"
              onClick={() => toggleOption(option)}
              className={`rounded-full px-4 py-2 text-xs font-semibold transition-all ${
                isSelected
                  ? "bg-primary text-white shadow-md"
                  : "border border-slate-200 bg-white text-slate-600 hover:border-primary/30 hover:bg-primary/5"
              }`}
            >
              {isSelected && <CheckCircle2 className="mr-1 inline size-3" />}
              {option}
            </button>
          )
        })}
      </div>
    </div>
  )
}

export function SupplierApplicationForm() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const user = useAuthUser()
  const draftUserId = resolveDraftUserId(user)
  const restoredForIdRef = useRef<string | null>(null)

  const [step, setStep] = useState(0)
  const [direction, setDirection] = useState(0)
  const [error, setError] = useState("")
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})
  const [success, setSuccess] = useState("")
  const [loading, setLoading] = useState(false)

  const [form, setForm] = useState<SupplierApplicationForm>(createEmptySupplierApplicationForm)

  const clearFieldError = useCallback((fieldPath: string) => {
    setFieldErrors((prev) => {
      if (!prev[fieldPath]) return prev
      const next = { ...prev }
      delete next[fieldPath]
      return next
    })
  }, [])

  const scrollToFirstError = useCallback((errors: Record<string, string>) => {
    const firstField = Object.keys(errors)[0]
    if (!firstField) return
    setError(errors[firstField])
    setTimeout(() => {
        const el = document.querySelector(`[data-field="${firstField}"]`)
        if (el) {
          el.scrollIntoView({ behavior: "smooth", block: "center" })
          const input = el.querySelector(
            "input, button, [tabindex]:not([tabindex='-1']), select"
          ) as HTMLElement | null
          if (input) {
            input.focus({ preventScroll: true })
          }
        }
    }, 150)
  }, [])

  useEffect(() => {
    if (user?.id || user?._id || user?.uid || user?.firebaseUid || user?.email) {
      const signedInId = getAuthUserId(user) ?? user.email
      if (signedInId) {
        rememberDraftUserId(signedInId)
        migrateAnonymousDraftToUser(signedInId)
      }
    }
  }, [user])

  useEffect(() => {
    const id = draftUserId || "anonymous"
    if (restoredForIdRef.current === id) return
    restoredForIdRef.current = id

    const draft = loadSupplierApplicationDraft(draftUserId)
    if (!draft) return

    window.setTimeout(() => setStep(draft.step), 0)
    window.setTimeout(() => setForm(mergeSupplierApplicationDraft(draft.form)), 0)
  }, [draftUserId])

  useEffect(() => {
    if (success) return

    const timeoutId = window.setTimeout(() => {
      saveSupplierApplicationDraft(draftUserId, { step, form })
    }, 350)

    return () => window.clearTimeout(timeoutId)
  }, [step, form, draftUserId, success])

  const updateForm = useCallback(
    (section: "businessInfo" | "operatingInfo" | "representativeInfo" | "businessDocuments" | "compliance", key: string, value: unknown) => {
      const fieldPath = `${section}.${key}`
      clearFieldError(fieldPath)

      setForm((prev) => {
        const sectionValue = prev[section]
        if (key.includes(".")) {
          const [parent, child] = key.split(".")
          return {
            ...prev,
            [section]: {
              ...sectionValue,
              [parent]: {
                ...((sectionValue as Record<string, unknown>)[parent] as Record<string, unknown>),
                [child]: value,
              },
            },
          }
        }
        return {
          ...prev,
          [section]: {
            ...sectionValue,
            [key]: value,
          },
        }
      })
    },
    [clearFieldError]
  )

  const ensureRequiredDocuments = useCallback((type: string, country: string) => {
    if (!type) return
    const required = documentRequirementsFor(type, country)
    setForm((prev) => {
      const existingTypes = new Set(
        prev.verificationDocuments.filter((d) => d.ownerType === "SUPPLIER").map((d) => d.type)
      )
      const missing = required
        .filter((t) => !existingTypes.has(t))
        .map((t) => ({
          key: `sup-${t}-${Math.random().toString(36).slice(2, 8)}`,
          type: t,
          ownerType: "SUPPLIER" as const,
          file: null,
        }))
      if (missing.length === 0) return prev
      return { ...prev, verificationDocuments: [...prev.verificationDocuments, ...missing] }
    })
  }, [])

  const handleSelectType = useCallback(
    (type: string) => {
      setForm((prev) => {
        if (prev.supplierType === type) return prev
        const required = documentRequirementsFor(type, prev.businessInfo.country)
        const existingTypes = new Set(
          prev.verificationDocuments.filter((d) => d.ownerType === "SUPPLIER").map((d) => d.type)
        )
        const missing = required
          .filter((t) => !existingTypes.has(t))
          .map((t) => ({
            key: `sup-${t}-${Math.random().toString(36).slice(2, 8)}`,
            type: t,
            ownerType: "SUPPLIER" as const,
            file: null,
          }))
        return { ...prev, supplierType: type, verificationDocuments: [...prev.verificationDocuments, ...missing] }
      })
    },
    []
  )

  const setVerificationDocFile = useCallback((key: string, file: File | null) => {
    setForm((prev) => ({
      ...prev,
      verificationDocuments: prev.verificationDocuments.map((d) =>
        d.key === key ? { ...d, file } : d
      ),
    }))
  }, [])

  const removeVerificationDoc = useCallback((key: string) => {
    setForm((prev) => ({
      ...prev,
      verificationDocuments: prev.verificationDocuments.filter((d) => d.key !== key),
    }))
  }, [])

  const addVehicle = useCallback(() => {
    const key = `vehicle-${Math.random().toString(36).slice(2, 8)}`
    setForm((prev) => ({
      ...prev,
      vehicles: [...prev.vehicles, { key, make: "", model: "", year: "", registrationNumber: "", photos: [] }],
      verificationDocuments: [
        ...prev.verificationDocuments,
        ...VEHICLE_DOC_TYPES.map((dt) => ({
          key: `${key}-${dt.type}`,
          type: dt.type,
          ownerType: "VEHICLE" as const,
          ownerKey: key,
          file: null,
        })),
      ],
    }))
  }, [])

  const updateVehicle = useCallback((key: string, field: "make" | "model" | "year" | "registrationNumber", value: string) => {
    setForm((prev) => ({
      ...prev,
      vehicles: prev.vehicles.map((v) => (v.key === key ? { ...v, [field]: value } : v)),
    }))
  }, [])

  const setVehiclePhotos = useCallback((key: string, photos: File[]) => {
    setForm((prev) => ({
      ...prev,
      vehicles: prev.vehicles.map((v) => (v.key === key ? { ...v, photos } : v)),
    }))
  }, [])

  const removeVehicle = useCallback((key: string) => {
    setForm((prev) => ({
      ...prev,
      vehicles: prev.vehicles.filter((v) => v.key !== key),
      verificationDocuments: prev.verificationDocuments.filter(
        (d) => !(d.ownerType === "VEHICLE" && d.ownerKey === key)
      ),
    }))
  }, [])

  const addGuide = useCallback(() => {
    const key = `guide-${Math.random().toString(36).slice(2, 8)}`
    setForm((prev) => ({
      ...prev,
      guides: [...prev.guides, { key, fullName: "", phone: "", email: "" }],
      verificationDocuments: [
        ...prev.verificationDocuments,
        ...GUIDE_DOC_TYPES.map((dt) => ({
          key: `${key}-${dt.type}`,
          type: dt.type,
          ownerType: "GUIDE" as const,
          ownerKey: key,
          file: null,
        })),
      ],
    }))
  }, [])

  const updateGuide = useCallback((key: string, field: "fullName" | "phone" | "email", value: string) => {
    setForm((prev) => ({
      ...prev,
      guides: prev.guides.map((g) => (g.key === key ? { ...g, [field]: value } : g)),
    }))
  }, [])

  const removeGuide = useCallback((key: string) => {
    setForm((prev) => ({
      ...prev,
      guides: prev.guides.filter((g) => g.key !== key),
      verificationDocuments: prev.verificationDocuments.filter(
        (d) => !(d.ownerType === "GUIDE" && d.ownerKey === key)
      ),
    }))
  }, [])

  const languageOptions = useMemo(
    () => getLanguagesForCountry(form.businessInfo.country),
    [form.businessInfo.country]
  )

  const stepCompleted = useMemo(
    () => STEPS.map((s) => getStepValidationError(s.key, form) === null),
    [form]
  )

  const handleCountryChange = useCallback((countryCode: string) => {
    setForm((prev) => ({
      ...prev,
      businessInfo: { ...prev.businessInfo, country: countryCode },
      operatingInfo: {
        ...prev.operatingInfo,
        languages: filterLanguagesForCountry(prev.operatingInfo.languages, countryCode),
      },
    }))
    ensureRequiredDocuments(form.supplierType, countryCode)
  }, [form.supplierType, ensureRequiredDocuments])

  useEffect(() => {
    const filtered = filterLanguagesForCountry(
      form.operatingInfo.languages,
      form.businessInfo.country
    )
    if (filtered.length === form.operatingInfo.languages.length) return

    window.setTimeout(() => setForm((prev) => ({
      ...prev,
      operatingInfo: { ...prev.operatingInfo, languages: filtered },
    })), 0)
  }, [form.businessInfo.country, form.operatingInfo.languages])

  const isFormComplete = useMemo(() => stepCompleted.every(Boolean), [stepCompleted])

  const validateStep = useCallback(() => {
    const err = getStepValidationError(STEPS[step].key, form)
    if (err) {
      setError(err)
      const errors = getFieldErrors(STEPS[step].key, form)
      setFieldErrors(errors)
      scrollToFirstError(errors)
      return false
    }
    setError("")
    setFieldErrors({})
    return true
  }, [step, form, scrollToFirstError])

  const validateAllSteps = useCallback(() => {
    for (let i = 0; i < STEPS.length; i++) {
      const err = getStepValidationError(STEPS[i].key, form)
      if (err) {
        setStep(i)
        setError(err)
        const errors = getFieldErrors(STEPS[i].key, form)
        setFieldErrors(errors)
        setTimeout(() => scrollToFirstError(errors), 200)
        return false
      }
    }
    setError("")
    setFieldErrors({})
    return true
  }, [form, scrollToFirstError])

  const handleNext = useCallback(() => {
    if (!validateStep()) return
    setDirection(1)
    setStep((prev) => Math.min(prev + 1, STEPS.length - 1))
  }, [validateStep])

  const handleBack = useCallback(() => {
    setError("")
    setDirection(-1)
    setStep((prev) => Math.max(prev - 1, 0))
  }, [])

  const handleStepClick = useCallback(
    (idx: number) => {
      setError("")
      setDirection(idx > step ? 1 : -1)
      setStep(idx)
    },
    [step]
  )

  const normalizeWebsite = (url: string): string => {
    if (!url || typeof url !== "string") return ""
    const trimmed = url.trim()
    if (!trimmed) return ""
    if (/^https?:\/\//i.test(trimmed)) return trimmed
    return `https://${trimmed}`
  }

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault()
      if (!validateAllSteps()) return

      setLoading(true)
      setError("")
      setSuccess("")

      try {
        const rep = form.representativeInfo

        // Build multipart/form-data payload (matches backend route/multer design)
        const payload = new FormData()

        payload.append("supplierType", form.supplierType)

        // JSON sections as strings (required by backend Swagger spec)
        payload.append(
          "businessInfo",
          JSON.stringify({
            ...form.businessInfo,
            website: normalizeWebsite(form.businessInfo.website),
          })
        )

        payload.append(
          "operatingInfo",
          JSON.stringify({
            ...form.operatingInfo,
            yearsInBusiness: parseInt(form.operatingInfo.yearsInBusiness, 10) || 0,
            cancellationPolicy: getCancellationPolicyText(form.operatingInfo.cancellationPolicy),
          })
        )

        // Representative info without the file (idDocument is sent separately)
        payload.append(
          "representativeInfo",
          JSON.stringify({
            fullName: rep.fullName,
            email: rep.email,
            dateOfBirth: rep.dateOfBirth,
            address: rep.address,
            idType: rep.idType,
          })
        )

        payload.append(
          "payoutInfo",
          JSON.stringify({
            bankAccountName: "",
            bankCountry: "",
            payoutCurrency: "",
          })
        )

        payload.append("compliance", JSON.stringify(form.compliance))

        // Generic per-type verification documents (paired with documentMeta).
        const documentMeta: { type: string; ownerType: string; ownerKey?: string }[] = []
        for (const d of form.verificationDocuments) {
          if (!d.file) continue
          payload.append("documents", d.file)
          documentMeta.push({
            type: d.type,
            ownerType: d.ownerType,
            ...(d.ownerType !== "SUPPLIER" && d.ownerKey ? { ownerKey: d.ownerKey } : {}),
          })
        }
        if (documentMeta.length > 0) {
          payload.append("documentMeta", JSON.stringify(documentMeta))
        }

        // Vehicles (JSON) + photos (paired with vehiclePhotoMeta).
        if (form.vehicles.length > 0) {
          payload.append(
            "vehicles",
            JSON.stringify(
              form.vehicles.map((v) => ({
                key: v.key,
                make: v.make,
                model: v.model,
                year: v.year ? parseInt(v.year, 10) : null,
                registrationNumber: v.registrationNumber,
              }))
            )
          )
          const photoMeta: { vehicleKey: string }[] = []
          for (const v of form.vehicles) {
            for (const p of v.photos) {
              photoMeta.push({ vehicleKey: v.key })
              payload.append("vehiclePhotos", p)
            }
          }
          if (photoMeta.length > 0) {
            payload.append("vehiclePhotoMeta", JSON.stringify(photoMeta))
          }
        }

        // Guides (JSON) — their documents travel in the generic `documents` list.
        if (form.guides.length > 0) {
          payload.append(
            "guides",
            JSON.stringify(
              form.guides.map((g) => ({
                key: g.key,
                fullName: g.fullName,
                phone: g.phone,
                email: g.email,
              }))
            )
          )
        }

        await applyAsSupplier(payload)
        clearSupplierApplicationDraft(draftUserId)
        setSuccess(
          "Your supplier application has been submitted successfully! Our team will review it and get back to you within 3-5 business days."
        )
      } catch (err) {
        setError((err as Error)?.message || "Failed to submit application. Please try again.")
      } finally {
        setLoading(false)
      }
    },
    [form, validateAllSteps, draftUserId]
  )

  const renderType = () => (
    <FormSection
      title="What type of supplier are you?"
      description="Pick the category that fits you best. We'll ask for the right documents for this category."
    >
      <div data-field="supplierType" className="grid gap-3 sm:grid-cols-2">
        {SUPPLIER_TYPES.map((type) => {
          const selected = form.supplierType === type.value
          const icon =
            type.value === "TOUR_GUIDE" ? <UserCircle className="size-5" /> :
            type.value === "TOUR_COMPANY" ? <Building2 className="size-5" /> :
            type.value === "TRANSPORTATION_PROVIDER" || type.value === "VEHICLE_OPERATOR" ? <Car className="size-5" /> :
            <Globe className="size-5" />
          return (
            <button
              key={type.value}
              type="button"
              onClick={() => {
                handleSelectType(type.value)
                clearFieldError("supplierType")
              }}
              aria-pressed={selected}
              className={`flex items-start gap-3 rounded-[1.4rem] border p-4 text-left transition-all ${selected ? "border-primary/50 bg-primary/5 ring-4 ring-primary/10" : "border-slate-200 bg-slate-50 hover:border-primary/30 hover:bg-white"}`}
            >
              <span className={`mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-full ${selected ? "bg-primary text-white" : "bg-slate-200 text-slate-500"}`}>
                {icon}
              </span>
              <span className="min-w-0">
                <span className={`block text-sm font-semibold ${selected ? "text-primary" : "text-slate-900"}`}>
                  {type.label}
                </span>
                <span className="mt-0.5 block text-xs leading-relaxed text-slate-500">{type.description}</span>
              </span>
            </button>
          )
        })}
      </div>
      <FieldError message={fieldErrors["supplierType"]} />
    </FormSection>
  )

  const renderBusinessInfo = () => (
    <FormSection
      title="Business Information"
      description="Tell us about your business. This information will be displayed to travellers."
    >
      <div className="grid gap-5 sm:grid-cols-2">
        <div className="sm:col-span-2" data-field="businessInfo.legalBusinessName">
          <FieldLabel required>Legal Business Name</FieldLabel>
          <div className={`flex items-center rounded-[1.4rem] border px-4 shadow-sm focus-within:border-primary/40 focus-within:ring-4 focus-within:ring-primary/10 ${fieldErrors["businessInfo.legalBusinessName"] ? "border-rose-300 bg-rose-50/30" : "border-slate-200 bg-slate-50"}`}>
            <Building2 className="size-4 text-slate-400" />
            <Input
              className="border-0 bg-transparent shadow-none focus:ring-0"
              placeholder="e.g. Adventure Tours Ltd"
              value={form.businessInfo.legalBusinessName}
              onChange={(e) => updateForm("businessInfo", "legalBusinessName", e.target.value)}
            />
          </div>
          <FieldError message={fieldErrors["businessInfo.legalBusinessName"]} />
        </div>

        <div className="sm:col-span-2" data-field="businessInfo.displayName">
          <FieldLabel required>Display Name</FieldLabel>
          <div className={`flex items-center rounded-[1.4rem] border px-4 shadow-sm focus-within:border-primary/40 focus-within:ring-4 focus-within:ring-primary/10 ${fieldErrors["businessInfo.displayName"] ? "border-rose-300 bg-rose-50/30" : "border-slate-200 bg-slate-50"}`}>
            <BadgeCheck className="size-4 text-slate-400" />
            <Input
              className="border-0 bg-transparent shadow-none focus:ring-0"
              placeholder="e.g. Adventure Tours"
              value={form.businessInfo.displayName}
              onChange={(e) => updateForm("businessInfo", "displayName", e.target.value)}
            />
          </div>
          <FieldError message={fieldErrors["businessInfo.displayName"]} />
        </div>

        <div data-field="businessInfo.businessType">
          <FieldLabel required>Business Type</FieldLabel>
          <Select
            value={form.businessInfo.businessType}
            onValueChange={(value) => updateForm("businessInfo", "businessType", value)}
          >
            <SelectTrigger className={`h-12 w-full rounded-[1.4rem] border shadow-sm ${fieldErrors["businessInfo.businessType"] ? "border-rose-300 bg-rose-50/30" : "border-input bg-white text-foreground"}`}>
              <SelectValue placeholder="Select business type" />
            </SelectTrigger>
            <SelectContent side="bottom" sideOffset={4}>
              {BUSINESS_TYPES.map((type) => (
                <SelectItem key={type.value} value={type.value}>
                  {type.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <FieldError message={fieldErrors["businessInfo.businessType"]} />
        </div>

        <div data-field="businessInfo.country">
          <FieldLabel required>Country</FieldLabel>
          <Select value={form.businessInfo.country} onValueChange={handleCountryChange}>
            <SelectTrigger className={`h-12 w-full rounded-[1.4rem] border shadow-sm ${fieldErrors["businessInfo.country"] ? "border-rose-300 bg-rose-50/30" : "border-input bg-white text-foreground"}`}>
              <SelectValue placeholder="Select country" />
            </SelectTrigger>
            <SelectContent side="bottom" sideOffset={4}>
              {COUNTRIES.map((c) => (
                <SelectItem key={c.code} value={c.code}>
                  {c.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <FieldError message={fieldErrors["businessInfo.country"]} />
        </div>

        <div className="sm:col-span-2" data-field="businessInfo.address.line1">
          <FieldLabel required>Address Line 1</FieldLabel>
          <div className={`flex items-center rounded-[1.4rem] border px-4 shadow-sm focus-within:border-primary/40 focus-within:ring-4 focus-within:ring-primary/10 ${fieldErrors["businessInfo.address.line1"] ? "border-rose-300 bg-rose-50/30" : "border-slate-200 bg-slate-50"}`}>
            <MapPin className="size-4 text-slate-400" />
            <Input
              className="border-0 bg-transparent shadow-none focus:ring-0"
              placeholder="Street address"
              value={form.businessInfo.address.line1}
              onChange={(e) => updateForm("businessInfo", "address.line1", e.target.value)}
            />
          </div>
          <FieldError message={fieldErrors["businessInfo.address.line1"]} />
        </div>

        <div className="sm:col-span-2">
          <FieldLabel>Address Line 2</FieldLabel>
          <div className="flex items-center rounded-[1.4rem] border border-slate-200 bg-slate-50 px-4 shadow-sm focus-within:border-primary/40 focus-within:ring-4 focus-within:ring-primary/10">
            <MapPin className="size-4 text-slate-400" />
            <Input
              className="border-0 bg-transparent shadow-none focus:ring-0"
              placeholder="Apartment, suite, unit, etc. (optional)"
              value={form.businessInfo.address.line2}
              onChange={(e) => updateForm("businessInfo", "address.line2", e.target.value)}
            />
          </div>
        </div>

        <div data-field="businessInfo.address.city">
          <FieldLabel required>City</FieldLabel>
          <Input
            placeholder="City"
            value={form.businessInfo.address.city}
            onChange={(e) => updateForm("businessInfo", "address.city", e.target.value)}
            className={fieldErrors["businessInfo.address.city"] ? "!border-rose-300 !bg-rose-50/30" : ""}
          />
          <FieldError message={fieldErrors["businessInfo.address.city"]} />
        </div>

        <div data-field="businessInfo.address.state">
          <FieldLabel required>State / Province</FieldLabel>
          <Input
            placeholder="State / Province"
            value={form.businessInfo.address.state}
            onChange={(e) => updateForm("businessInfo", "address.state", e.target.value)}
            className={fieldErrors["businessInfo.address.state"] ? "!border-rose-300 !bg-rose-50/30" : ""}
          />
          <FieldError message={fieldErrors["businessInfo.address.state"]} />
        </div>

        <div data-field="businessInfo.address.postalCode">
          <FieldLabel required>Postal Code</FieldLabel>
          <Input
            placeholder="Postal Code"
            value={form.businessInfo.address.postalCode}
            onChange={(e) => updateForm("businessInfo", "address.postalCode", e.target.value)}
            className={fieldErrors["businessInfo.address.postalCode"] ? "!border-rose-300 !bg-rose-50/30" : ""}
          />
          <FieldError message={fieldErrors["businessInfo.address.postalCode"]} />
        </div>

        <div data-field="businessInfo.phoneNumber">
          <FieldLabel required>Phone Number</FieldLabel>
          <div className={`flex items-center rounded-[1.4rem] border px-4 shadow-sm focus-within:border-primary/40 focus-within:ring-4 focus-within:ring-primary/10 ${fieldErrors["businessInfo.phoneNumber"] ? "border-rose-300 bg-rose-50/30" : "border-slate-200 bg-slate-50"}`}>
            <Phone className="size-4 text-slate-400" />
            <Input
              className="border-0 bg-transparent shadow-none focus:ring-0"
              placeholder="+1-555-123-4567"
              value={form.businessInfo.phoneNumber}
              onChange={(e) => updateForm("businessInfo", "phoneNumber", e.target.value)}
            />
          </div>
          <FieldError message={fieldErrors["businessInfo.phoneNumber"]} />
        </div>

        <div className="sm:col-span-2" data-field="businessInfo.website">
          <FieldLabel>Website</FieldLabel>
          <div className="flex items-center rounded-[1.4rem] border border-slate-200 bg-slate-50 px-4 shadow-sm focus-within:border-primary/40 focus-within:ring-4 focus-within:ring-primary/10">
            <LinkIcon className="size-4 text-slate-400" />
            <Input
              className="border-0 bg-transparent shadow-none focus:ring-0"
              placeholder="https://yourbusiness.com"
              type="url"
              value={form.businessInfo.website}
              onChange={(e) => updateForm("businessInfo", "website", e.target.value)}
              onBlur={(e) => {
                const val = e.target.value.trim()
                if (val && !/^https?:\/\//i.test(val)) {
                  updateForm("businessInfo", "website", `https://${val}`)
                }
              }}
            />
          </div>
        </div>
      </div>
    </FormSection>
  )

  const renderOperatingInfo = () => (
    <FormSection
      title="Operating Information"
      description="Tell us about the tours and experiences you offer."
    >
      <div data-field="operatingInfo.tourCategories">
        <MultiSelect
          label="Tour Categories"
          options={TOUR_CATEGORIES_OPTIONS}
          selected={form.operatingInfo.tourCategories}
          onChange={(value) => updateForm("operatingInfo", "tourCategories", value)}
          required
        />
        <FieldError message={fieldErrors["operatingInfo.tourCategories"]} />
      </div>

      <div data-field="operatingInfo.destinations">
        <GhanaDestinationSelect
          selected={form.operatingInfo.destinations}
          onChange={(value) => updateForm("operatingInfo", "destinations", value)}
          required
        />
        <FieldError message={fieldErrors["operatingInfo.destinations"]} />
      </div>

      <div data-field="operatingInfo.languages">
        <MultiSelect
          label="Languages Offered"
          options={languageOptions}
          selected={form.operatingInfo.languages}
          onChange={(value) => updateForm("operatingInfo", "languages", value)}
          required
        />
        <FieldError message={fieldErrors["operatingInfo.languages"]} />
      </div>
      <p className="-mt-3 text-xs text-slate-500">
        {form.businessInfo.country
          ? "English and French are always available, plus local languages for your country."
          : "Select your business country (step 1) to see local language options. English and French are always available."}
      </p>

      <div className="grid gap-5 sm:grid-cols-2">
        <div data-field="operatingInfo.yearsInBusiness">
          <FieldLabel>Years in Business</FieldLabel>
          <Input
            type="number"
            min="0"
            placeholder="e.g. 5"
            value={form.operatingInfo.yearsInBusiness}
            onChange={(e) => updateForm("operatingInfo", "yearsInBusiness", e.target.value)}
            className={fieldErrors["operatingInfo.yearsInBusiness"] ? "!border-rose-300 !bg-rose-50/30" : ""}
          />
          <FieldError message={fieldErrors["operatingInfo.yearsInBusiness"]} />
        </div>

        <div data-field="operatingInfo.meetingStyle">
          <FieldLabel required>Meeting Style</FieldLabel>
          <Select
            value={form.operatingInfo.meetingStyle}
            onValueChange={(value) => updateForm("operatingInfo", "meetingStyle", value)}
          >
            <SelectTrigger className={`h-12 w-full rounded-[1.4rem] border shadow-sm ${fieldErrors["operatingInfo.meetingStyle"] ? "border-rose-300 bg-rose-50/30" : "border-input bg-white text-foreground"}`}>
              <SelectValue placeholder="Select meeting style" />
            </SelectTrigger>
            <SelectContent side="bottom" sideOffset={4}>
              {MEETING_STYLES.map((style) => (
                <SelectItem key={style.value} value={style.value}>
                  {style.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <FieldError message={fieldErrors["operatingInfo.meetingStyle"]} />
        </div>
      </div>

      <div data-field="operatingInfo.cancellationPolicy">
        <FieldLabel required>Cancellation Policy</FieldLabel>
        <Select
          value={form.operatingInfo.cancellationPolicy || undefined}
          onValueChange={(value) => updateForm("operatingInfo", "cancellationPolicy", value)}
        >
          <SelectTrigger className={`h-12 w-full rounded-[1.4rem] border shadow-sm ${fieldErrors["operatingInfo.cancellationPolicy"] ? "border-rose-300 bg-rose-50/30" : "border-input bg-white text-foreground"}`}>
            <SelectValue placeholder="Select a cancellation policy" />
          </SelectTrigger>
          <SelectContent side="bottom" sideOffset={4} className="max-w-[min(100vw-2rem,32rem)]">
            {CANCELLATION_POLICY_OPTIONS.map((policy) => (
              <SelectItem key={policy.value} value={policy.value}>
                {policy.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <FieldError message={fieldErrors["operatingInfo.cancellationPolicy"]} />
        <div
          className="mt-3 min-h-[17rem] rounded-[1.4rem] border border-slate-200 bg-slate-50 px-4 py-3 text-sm leading-relaxed text-slate-600"
          aria-live="polite"
        >
          {form.operatingInfo.cancellationPolicy ? (
            <p className="whitespace-pre-line">
              {getCancellationPolicyText(form.operatingInfo.cancellationPolicy)}
            </p>
          ) : (
            <p className="text-slate-400">Select a policy above to preview the full terms.</p>
          )}
        </div>
      </div>
    </FormSection>
  )

  const renderRepresentativeInfo = () => (
    <FormSection
      title="Representative Information"
      description="Provide details about the primary contact person for your business."
    >
      <div className="grid gap-5 sm:grid-cols-2">
        <div data-field="representativeInfo.fullName">
          <FieldLabel required>Full Name</FieldLabel>
          <div className={`flex items-center rounded-[1.4rem] border px-4 shadow-sm focus-within:border-primary/40 focus-within:ring-4 focus-within:ring-primary/10 ${fieldErrors["representativeInfo.fullName"] ? "border-rose-300 bg-rose-50/30" : "border-slate-200 bg-slate-50"}`}>
            <UserCircle className="size-4 text-slate-400" />
            <Input
              className="border-0 bg-transparent shadow-none focus:ring-0"
              placeholder="John Smith"
              value={form.representativeInfo.fullName}
              onChange={(e) => updateForm("representativeInfo", "fullName", e.target.value)}
            />
          </div>
          <FieldError message={fieldErrors["representativeInfo.fullName"]} />
        </div>

        <div data-field="representativeInfo.email">
          <FieldLabel required>Email</FieldLabel>
          <div className={`flex items-center rounded-[1.4rem] border px-4 shadow-sm focus-within:border-primary/40 focus-within:ring-4 focus-within:ring-primary/10 ${fieldErrors["representativeInfo.email"] ? "border-rose-300 bg-rose-50/30" : "border-slate-200 bg-slate-50"}`}>
            <Globe className="size-4 text-slate-400" />
            <Input
              className="border-0 bg-transparent shadow-none focus:ring-0"
              type="email"
              placeholder="john@example.com"
              value={form.representativeInfo.email}
              onChange={(e) => updateForm("representativeInfo", "email", e.target.value)}
            />
          </div>
          <FieldError message={fieldErrors["representativeInfo.email"]} />
        </div>

        <div data-field="representativeInfo.dateOfBirth">
          <FieldLabel required>Date of Birth</FieldLabel>
          <DatePicker
            value={form.representativeInfo.dateOfBirth}
            onChange={(value) => updateForm("representativeInfo", "dateOfBirth", value)}
            placeholder="dd-mm-yyyy"
            maxDate={new Date()}
            minDate={new Date(1920, 0, 1)}
          />
          <FieldError message={fieldErrors["representativeInfo.dateOfBirth"]} />
        </div>

        <div data-field="representativeInfo.idType">
          <FieldLabel required>ID Type</FieldLabel>
          <Select
            value={form.representativeInfo.idType}
            onValueChange={(value) => updateForm("representativeInfo", "idType", value)}
          >
            <SelectTrigger className={`h-12 w-full rounded-[1.4rem] border shadow-sm ${fieldErrors["representativeInfo.idType"] ? "border-rose-300 bg-rose-50/30" : "border-input bg-white text-foreground"}`}>
              <SelectValue placeholder="Select ID type" />
            </SelectTrigger>
            <SelectContent side="bottom" sideOffset={4}>
              {ID_TYPES.map((type) => (
                <SelectItem key={type.value} value={type.value}>
                  {type.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <FieldError message={fieldErrors["representativeInfo.idType"]} />
        </div>

        <div className="sm:col-span-2 rounded-[1.4rem] border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
          You'll upload a photo of your ID (Ghana Card or National ID) in the{" "}
          <span className="font-semibold text-slate-900">Documents</span> step based on your supplier type.
        </div>

        <div className="sm:col-span-2" data-field="representativeInfo.address.line1">
          <FieldLabel required>Address Line 1</FieldLabel>
          <div className={`flex items-center rounded-[1.4rem] border px-4 shadow-sm focus-within:border-primary/40 focus-within:ring-4 focus-within:ring-primary/10 ${fieldErrors["representativeInfo.address.line1"] ? "border-rose-300 bg-rose-50/30" : "border-slate-200 bg-slate-50"}`}>
            <MapPin className="size-4 text-slate-400" />
            <Input
              className="border-0 bg-transparent shadow-none focus:ring-0"
              placeholder="Street address"
              value={form.representativeInfo.address.line1}
              onChange={(e) => updateForm("representativeInfo", "address.line1", e.target.value)}
            />
          </div>
          <FieldError message={fieldErrors["representativeInfo.address.line1"]} />
        </div>

        <div className="sm:col-span-2" data-field="representativeInfo.address.line2">
          <FieldLabel>Address Line 2</FieldLabel>
          <div className="flex items-center rounded-[1.4rem] border border-slate-200 bg-slate-50 px-4 shadow-sm focus-within:border-primary/40 focus-within:ring-4 focus-within:ring-primary/10">
            <MapPin className="size-4 text-slate-400" />
            <Input
              className="border-0 bg-transparent shadow-none focus:ring-0"
              placeholder="Apartment, suite, unit, etc. (optional)"
              value={form.representativeInfo.address.line2}
              onChange={(e) => updateForm("representativeInfo", "address.line2", e.target.value)}
            />
          </div>
        </div>

        <div data-field="representativeInfo.address.city">
          <FieldLabel required>City</FieldLabel>
          <Input
            placeholder="City"
            value={form.representativeInfo.address.city}
            onChange={(e) => updateForm("representativeInfo", "address.city", e.target.value)}
            className={fieldErrors["representativeInfo.address.city"] ? "!border-rose-300 !bg-rose-50/30" : ""}
          />
          <FieldError message={fieldErrors["representativeInfo.address.city"]} />
        </div>

        <div data-field="representativeInfo.address.state">
          <FieldLabel required>State / Province</FieldLabel>
          <Input
            placeholder="State / Province"
            value={form.representativeInfo.address.state}
            onChange={(e) => updateForm("representativeInfo", "address.state", e.target.value)}
            className={fieldErrors["representativeInfo.address.state"] ? "!border-rose-300 !bg-rose-50/30" : ""}
          />
          <FieldError message={fieldErrors["representativeInfo.address.state"]} />
        </div>

        <div data-field="representativeInfo.address.postalCode">
          <FieldLabel required>Postal Code</FieldLabel>
          <Input
            placeholder="Postal Code"
            value={form.representativeInfo.address.postalCode}
            onChange={(e) => updateForm("representativeInfo", "address.postalCode", e.target.value)}
            className={fieldErrors["representativeInfo.address.postalCode"] ? "!border-rose-300 !bg-rose-50/30" : ""}
          />
          <FieldError message={fieldErrors["representativeInfo.address.postalCode"]} />
        </div>
      </div>
    </FormSection>
  )

  const renderDocuments = () => {
    const supplierDocs = form.verificationDocuments.filter((d) => d.ownerType === "SUPPLIER")
    const wantsVehicles =
      form.supplierType === "TRANSPORTATION_PROVIDER" || form.supplierType === "VEHICLE_OPERATOR"
    const wantsGuides = form.supplierType === "TOUR_COMPANY"

    return (
      <FormSection
        title="Documents"
        description={`Upload the documents required for a ${supplierTypeLabel(form.supplierType).toLowerCase()}. Each document is reviewed individually before you can go live.`}
      >
        <div className="space-y-6">
          <div className="space-y-3">
            <h4 className="text-sm font-bold text-slate-900">Required documents</h4>
            {supplierDocs.map((doc) => (
              <div key={doc.key} data-field={`verificationDocuments.${doc.key}`} className="flex items-start gap-3">
                <div className="min-w-0 flex-1">
                  <ImageUploadField
                    label={documentTypeLabel(doc.type)}
                    file={doc.file}
                    onChange={(file) => setVerificationDocFile(doc.key, file)}
                    required
                  />
                </div>
                <button
                  type="button"
                  onClick={() => removeVerificationDoc(doc.key)}
                  className="mt-8 flex size-9 shrink-0 items-center justify-center rounded-full border border-slate-200 text-slate-400 transition hover:border-rose-200 hover:bg-rose-50 hover:text-rose-500"
                  aria-label={`Remove ${documentTypeLabel(doc.type)}`}
                >
                  <Trash2 className="size-4" />
                </button>
              </div>
            ))}
          </div>

          {wantsVehicles && (
            <div className="space-y-3 border-t border-slate-200 pt-5">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-sm font-bold text-slate-900">Vehicles</h4>
                  <p className="text-xs text-slate-500">Each vehicle needs its registration, ownership, roadworthiness and insurance documents.</p>
                </div>
                <button
                  type="button"
                  onClick={addVehicle}
                  className="inline-flex items-center gap-1.5 rounded-full bg-primary px-3.5 py-2 text-xs font-semibold text-white transition hover:bg-primary/90"
                >
                  <Plus className="size-3.5" /> Add vehicle
                </button>
              </div>
              {form.vehicles.length === 0 && (
                <p className="rounded-xl border border-dashed border-slate-300 bg-slate-50 px-4 py-4 text-center text-sm text-slate-500">
                  No vehicles yet — add at least one to continue.
                </p>
              )}
              {form.vehicles.map((v, idx) => {
                const vehicleDocs = form.verificationDocuments.filter(
                  (d) => d.ownerType === "VEHICLE" && d.ownerKey === v.key
                )
                return (
                  <div key={v.key} className="space-y-3 rounded-2xl border border-slate-200 bg-slate-50 p-4">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-semibold text-slate-900">Vehicle {idx + 1}</p>
                      <button
                        type="button"
                        onClick={() => removeVehicle(v.key)}
                        className="inline-flex items-center gap-1 rounded-full border border-slate-200 px-2.5 py-1 text-xs text-slate-500 transition hover:border-rose-200 hover:text-rose-500"
                      >
                        <Trash2 className="size-3" /> Remove
                      </button>
                    </div>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <div>
                        <FieldLabel required>Make</FieldLabel>
                        <Input placeholder="e.g. Toyota" value={v.make} onChange={(e) => updateVehicle(v.key, "make", e.target.value)} />
                      </div>
                      <div>
                        <FieldLabel required>Model</FieldLabel>
                        <Input placeholder="e.g. Hiace" value={v.model} onChange={(e) => updateVehicle(v.key, "model", e.target.value)} />
                      </div>
                      <div>
                        <FieldLabel>Year</FieldLabel>
                        <Input placeholder="e.g. 2022" value={v.year} onChange={(e) => updateVehicle(v.key, "year", e.target.value)} />
                      </div>
                      <div>
                        <FieldLabel required>Registration number</FieldLabel>
                        <Input placeholder="e.g. GR 1234-20" value={v.registrationNumber} onChange={(e) => updateVehicle(v.key, "registrationNumber", e.target.value)} />
                      </div>
                    </div>
                    <div className="grid gap-3 sm:grid-cols-2">
                      {vehicleDocs.map((doc) => (
                        <div key={doc.key}>
                          <ImageUploadField
                            label={documentTypeLabel(doc.type)}
                            file={doc.file}
                            onChange={(file) => setVerificationDocFile(doc.key, file)}
                            required
                          />
                        </div>
                      ))}
                    </div>
                    <MultiImageUploadField
                      label="Vehicle photos"
                      files={v.photos}
                      onChange={(photos) => setVehiclePhotos(v.key, photos)}
                    />
                  </div>
                )
              })}
            </div>
          )}

          {wantsGuides && (
            <div className="space-y-3 border-t border-slate-200 pt-5">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-sm font-bold text-slate-900">Your guides</h4>
                  <p className="text-xs text-slate-500">Each guide gets their own verified profile and licence documents.</p>
                </div>
                <button
                  type="button"
                  onClick={addGuide}
                  className="inline-flex items-center gap-1.5 rounded-full bg-primary px-3.5 py-2 text-xs font-semibold text-white transition hover:bg-primary/90"
                >
                  <Plus className="size-3.5" /> Add guide
                </button>
              </div>
              {form.guides.length === 0 && (
                <p className="rounded-xl border border-dashed border-slate-300 bg-slate-50 px-4 py-4 text-center text-sm text-slate-500">
                  No guides yet. Add the guides who will lead your tours.
                </p>
              )}
              {form.guides.map((g, idx) => {
                const guideDocs = form.verificationDocuments.filter(
                  (d) => d.ownerType === "GUIDE" && d.ownerKey === g.key
                )
                return (
                  <div key={g.key} className="space-y-3 rounded-2xl border border-slate-200 bg-slate-50 p-4">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-semibold text-slate-900">Guide {idx + 1}</p>
                      <button
                        type="button"
                        onClick={() => removeGuide(g.key)}
                        className="inline-flex items-center gap-1 rounded-full border border-slate-200 px-2.5 py-1 text-xs text-slate-500 transition hover:border-rose-200 hover:text-rose-500"
                      >
                        <Trash2 className="size-3" /> Remove
                      </button>
                    </div>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <div>
                        <FieldLabel required>Full name</FieldLabel>
                        <Input placeholder="e.g. Kofi Mensah" value={g.fullName} onChange={(e) => updateGuide(g.key, "fullName", e.target.value)} />
                      </div>
                      <div>
                        <FieldLabel>Phone</FieldLabel>
                        <Input placeholder="+233..." value={g.phone} onChange={(e) => updateGuide(g.key, "phone", e.target.value)} />
                      </div>
                      <div className="sm:col-span-2">
                        <FieldLabel>Email</FieldLabel>
                        <Input placeholder="guide@example.com" value={g.email} onChange={(e) => updateGuide(g.key, "email", e.target.value)} />
                      </div>
                    </div>
                    <div className="grid gap-3 sm:grid-cols-2">
                      {guideDocs.map((doc) => (
                        <div key={doc.key}>
                          <ImageUploadField
                            label={documentTypeLabel(doc.type)}
                            file={doc.file}
                            onChange={(file) => setVerificationDocFile(doc.key, file)}
                            required
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </FormSection>
    )
  }

  const renderCompliance = () => (
    <FormSection
      title="Review & Submit"
      description="Please review your information and accept the terms before submitting."
    >
      <div className="space-y-4 rounded-2xl border border-slate-200 bg-slate-50 p-5">
        <h4 className="text-sm font-bold text-slate-900">Application Summary</h4>
        <div className="space-y-2 text-sm text-slate-600">
          <div className="flex justify-between">
            <span>Business:</span>
            <span className="font-semibold text-slate-900">
              {form.businessInfo.legalBusinessName || "—"}
            </span>
          </div>
          <div className="flex justify-between">
            <span>Supplier type:</span>
            <span className="font-semibold text-slate-900">
              {supplierTypeLabel(form.supplierType) || "—"}
            </span>
          </div>
          {form.vehicles.length > 0 && (
            <div className="flex justify-between">
              <span>Vehicles:</span>
              <span className="font-semibold text-slate-900">{form.vehicles.length}</span>
            </div>
          )}
          {form.guides.length > 0 && (
            <div className="flex justify-between">
              <span>Guides:</span>
              <span className="font-semibold text-slate-900">{form.guides.length}</span>
            </div>
          )}
          <div className="flex justify-between">
            <span>Display Name:</span>
            <span className="font-semibold text-slate-900">
              {form.businessInfo.displayName || "—"}
            </span>
          </div>
          <div className="flex justify-between">
            <span>Country:</span>
            <span className="font-semibold text-slate-900">
              {COUNTRIES.find((c) => c.code === form.businessInfo.country)?.name || "—"}
            </span>
          </div>
          <div className="flex justify-between">
            <span>Categories:</span>
            <span className="font-semibold text-slate-900">
              {form.operatingInfo.tourCategories.join(", ") || "—"}
            </span>
          </div>
          <div className="flex justify-between gap-4">
            <span className="shrink-0">Cancellation policy:</span>
            <span className="text-right font-semibold text-slate-900">
              {getCancellationPolicyLabel(form.operatingInfo.cancellationPolicy) || "—"}
            </span>
          </div>
          <div className="flex justify-between">
            <span>Representative:</span>
            <span className="font-semibold text-slate-900">
              {form.representativeInfo.fullName || "—"}
            </span>
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-amber-100 bg-amber-50 px-4 py-3 text-sm text-amber-800">
        <p>
          <span className="font-semibold">Note:</span> Payout information will be collected after
          your application is approved by our team.
        </p>
      </div>

      <div className="space-y-4">
        <div data-field="compliance.acceptedTerms">
          <label className={`flex items-start gap-3 rounded-[1.4rem] border px-4 py-3 shadow-sm cursor-pointer transition hover:border-primary/30 ${fieldErrors["compliance.acceptedTerms"] ? "border-rose-300 bg-rose-50/30" : "border-slate-200 bg-white"}`}>
            <div className="mt-0.5">
              <input
                type="checkbox"
                checked={form.compliance.acceptedTerms}
                onChange={(e) => updateForm("compliance", "acceptedTerms", e.target.checked)}
                className="h-4 w-4 rounded border-slate-300 text-primary focus:ring-primary"
              />
            </div>
            <span className="text-sm text-slate-700">
              I have read and accept the{" "}
              <span className="font-semibold text-primary">Terms and Conditions</span> and{" "}
              <span className="font-semibold text-primary">Supplier Agreement</span>.
            </span>
          </label>
          <FieldError message={fieldErrors["compliance.acceptedTerms"]} />
        </div>
      </div>

      {success && (
        <div className="rounded-[1.3rem] border border-emerald-100 bg-emerald-50 px-4 py-4 text-sm text-emerald-700">
          <div className="flex items-start gap-2">
            <CheckCircle2 className="mt-0.5 size-5 shrink-0" />
            <div>
              <p className="font-semibold">Application Submitted!</p>
              <p className="mt-1">{success}</p>
              <button
                type="button"
                onClick={() => navigate("/")}
                className="mt-3 inline-flex items-center gap-2 rounded-full bg-emerald-600 px-4 py-2 text-xs font-semibold text-white transition hover:bg-emerald-700"
              >
                Return to Homepage
              </button>
            </div>
          </div>
        </div>
      )}
    </FormSection>
  )

  const renderStepContent = () => {
    switch (STEPS[step].key) {
      case "type":
        return renderType()
      case "business":
        return renderBusinessInfo()
      case "operating":
        return renderOperatingInfo()
      case "representative":
        return renderRepresentativeInfo()
      case "documents":
        return renderDocuments()
      case "compliance":
        return renderCompliance()
      default:
        return null
    }
  }

  const stepVariants = {
    enter: (dir: number) => ({
      x: dir > 0 ? 120 : -120,
      opacity: 0,
    }),
    center: {
      x: 0,
      opacity: 1,
    },
    exit: (dir: number) => ({
      x: dir > 0 ? -120 : 120,
      opacity: 0,
    }),
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <StepIndicator
        steps={STEPS}
        currentStep={step}
        onStepClick={handleStepClick}
        stepCompleted={stepCompleted}
      />

      <div className="overflow-hidden rounded-[24px] border border-slate-200 bg-white p-6 shadow-[0_12px_40px_rgba(15,23,42,0.06)] sm:p-8 min-h-[600px]">
        <AnimatePresence mode="wait" custom={direction}>
          <motion.div
            key={STEPS[step].key}
            custom={direction}
            variants={stepVariants}
            initial="enter"
            animate="center"
            exit="exit"
            transition={{
              x: { type: "spring", stiffness: 260, damping: 25 },
              opacity: { duration: 0.15 },
            }}
          >
            {renderStepContent()}
          </motion.div>
        </AnimatePresence>
      </div>

      {error && !success && (
        <div className="flex items-start gap-2 rounded-[1.3rem] border border-rose-100 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          <AlertCircle className="mt-0.5 size-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4">
        <Button
          type="button"
          variant="outline"
          onClick={handleBack}
          disabled={step === 0 || loading}
          className="h-12 px-6"
        >
          <ChevronLeft className="size-4" />
          Back
        </Button>

        {step < STEPS.length - 1 ? (
          <Button type="button" onClick={handleNext} disabled={loading} className="h-12 px-6">
            Next
            <ChevronRight className="size-4" />
          </Button>
        ) : (
          <div className="flex flex-col items-stretch sm:items-end gap-1">
            <Button
              type="submit"
              disabled={loading || !!success || !isFormComplete}
              className="h-12 px-6"
              title={
                !isFormComplete
                  ? t(
                      "supplierRegister.completeAllSteps",
                      "Complete all steps and required fields before submitting"
                    )
                  : undefined
              }
            >
              {loading ? <LoaderCircle className="mr-2 size-4 animate-spin" /> : null}
              {t("supplierRegister.submitApplication", "Submit Application")}
            </Button>
            {!isFormComplete && !success && (
              <p className="text-xs text-slate-500">
                {t(
                  "supplierRegister.completeAllStepsHint",
                  "Fill in every step to enable submission"
                )}
              </p>
            )}
          </div>
        )}
      </div>
    </form>
  )
}
