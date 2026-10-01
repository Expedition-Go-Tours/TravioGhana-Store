/**
 * Multi-step partner application form.
 * Shared across all 4 partner types with custom steps per type.
 *
 * Layout: left sidebar step indicator + top progress bar + right form content.
 */
import {
  useState,
  useCallback,
  useRef,
  useEffect,
  useId,
  useLayoutEffect,
  Children,
  isValidElement,
} from "react"
import { useNavigate } from "react-router-dom"
import { motion, AnimatePresence } from "framer-motion"
import {
  AlertCircle,
  ArrowLeft,
  Check,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  Upload,
  X,
} from "lucide-react"

import { Button } from "@/components/ui/button"
import { useComingSoon } from "@/hooks/useComingSoon"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"
import {
  type PartnerType,
  type PartnerFormConfig,
  PHONE_CODES,
  TOUR_CATEGORIES,
  AMENITIES,
  VEHICLE_TYPES,
  COVERAGE_REGIONS,
  COUNTRIES,
  BUSINESS_TYPES_LIST,
  LANGUAGES,
  MEETING_STYLES,
  CANCELLATION_POLICIES,
  ID_TYPES,
} from "./partnerFormConfig"

interface PartnerApplicationFormProps {
  partnerType: PartnerType
  config: PartnerFormConfig
  onBack?: () => void
}

/* ========================= Sub-components ========================= */

function FieldLabel({ children, required }: { children: React.ReactNode; required?: boolean }) {
  return (
    <label className="mb-1.5 block text-sm font-semibold text-slate-700">
      {children}
      {required && <span className="ml-1 text-rose-500">*</span>}
    </label>
  )
}

function FormCard({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-[0_2px_12px_rgba(0,0,0,0.04)] sm:p-8">
      {children}
    </div>
  )
}

interface SelectOptionProps {
  value?: unknown
  disabled?: boolean
  children?: React.ReactNode
}

function nodeText(node: React.ReactNode): string {
  if (node == null) return ""
  if (typeof node === "string" || typeof node === "number") return String(node)
  if (Array.isArray(node)) return node.map(nodeText).join("")
  if (isValidElement(node)) return nodeText((node.props as SelectOptionProps).children)
  return ""
}

/**
 * Dropdown select field rendered in plain React (fixed-position floating menu
 * with viewport-aware flip). Accepts <option> children — same API as a native
 * <select> — so form markup stays untouched.
 */
function DropdownSelect({
  value,
  onValueChange,
  placeholder,
  className = "",
  children,
}: {
  value: string
  onValueChange: (val: string) => void
  placeholder?: string
  className?: string
  children: React.ReactNode
}) {
  const options = Children.toArray(children).reduce<{ value: string; label: string }[]>(
    (acc, child) => {
      if (!isValidElement<SelectOptionProps>(child)) return acc
      const { value: optionValue, disabled, children: label } = child.props
      if (disabled || optionValue === undefined || optionValue === "") return acc
      acc.push({ value: String(optionValue), label: nodeText(label) })
      return acc
    },
    []
  )

  const selected = options.find((o) => o.value === value)
  const selectedIndex = Math.max(
    0,
    options.findIndex((o) => o.value === value)
  )

  const [open, setOpen] = useState(false)
  const [visible, setVisible] = useState(false)
  const [anchor, setAnchor] = useState<{
    left: number
    top: number
    width: number
    maxHeight: number
  } | null>(null)
  const [activeIndex, setActiveIndex] = useState(-1)

  const triggerRef = useRef<HTMLButtonElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)
  const optionRefs = useRef<(HTMLButtonElement | null)[]>([])
  const menuId = useId()

  const GAP = 8

  const closeMenu = useCallback(() => {
    setOpen(false)
    setVisible(false)
    setAnchor(null)
    setActiveIndex(-1)
  }, [])

  /* Position the fixed menu relative to the trigger, flipping above when it
     would overflow the viewport bottom. */
  const placeMenu = useCallback(() => {
    const trigger = triggerRef.current
    const menu = menuRef.current
    if (!trigger || !menu) return

    const rect = trigger.getBoundingClientRect()
    const menuHeight = menu.offsetHeight
    const spaceBelow = window.innerHeight - rect.bottom - GAP
    const spaceAbove = rect.top - GAP
    const placeAbove = menuHeight > spaceBelow && menuHeight <= spaceAbove

    const width = Math.max(1, rect.width)
    const left = Math.min(Math.max(GAP, rect.left), Math.max(GAP, window.innerWidth - width - GAP))
    const maxHeight = Math.max(160, (placeAbove ? spaceAbove : spaceBelow) - GAP)
    const top = placeAbove ? Math.max(GAP, rect.top - GAP - menuHeight) : rect.bottom + GAP

    setAnchor({ left, top, width, maxHeight })
  }, [])

  const openMenu = useCallback(() => {
    setActiveIndex(selectedIndex)
    setOpen(true)
  }, [selectedIndex])

  const focusOption = useCallback((index: number) => {
    optionRefs.current[index]?.focus({ preventScroll: true })
    setActiveIndex(index)
  }, [])

  /* Close on outside click or Escape while open */
  useEffect(() => {
    if (!open) return
    const onPointerDown = (e: MouseEvent | TouchEvent) => {
      const target = e.target as Node
      if (triggerRef.current?.contains(target) || menuRef.current?.contains(target)) return
      closeMenu()
    }
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        closeMenu()
        triggerRef.current?.focus()
      }
    }
    document.addEventListener("pointerdown", onPointerDown, true)
    document.addEventListener("keydown", onKeyDown, true)
    return () => {
      document.removeEventListener("pointerdown", onPointerDown, true)
      document.removeEventListener("keydown", onKeyDown, true)
    }
  }, [open, closeMenu])

  /* Mount → position → trigger entrance transition on the next frame.
     Re-measure once the transition has settled so late font/layout changes
     can never leave the menu visually detached from the trigger. */
  useLayoutEffect(() => {
    if (!open) return
    placeMenu()
    const raf = requestAnimationFrame(() => {
      setVisible(true)
      requestAnimationFrame(() => placeMenu())
    })
    return () => cancelAnimationFrame(raf)
  }, [open, placeMenu])

  const handleTransitionEnd = useCallback(() => {
    if (open) placeMenu()
  }, [open, placeMenu])

  /* Keep the menu glued to the trigger while scrolling; close on resize */
  useEffect(() => {
    if (!open) return
    let ticking = false
    const onScroll = () => {
      if (ticking) return
      ticking = true
      requestAnimationFrame(() => {
        placeMenu()
        ticking = false
      })
    }
    const onResize = () => closeMenu()
    window.addEventListener("scroll", onScroll, true)
    window.addEventListener("resize", onResize)
    return () => {
      window.removeEventListener("scroll", onScroll, true)
      window.removeEventListener("resize", onResize)
    }
  }, [open, placeMenu, closeMenu])

  /* Keep the active option in view inside the scrollable menu */
  useEffect(() => {
    if (!open || activeIndex < 0) return
    const el = optionRefs.current[activeIndex]
    if (el) el.scrollIntoView({ block: "nearest" })
  }, [open, activeIndex])

  const handleMenuKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (options.length === 0) return
    switch (e.key) {
      case "ArrowDown":
        e.preventDefault()
        focusOption(Math.min(activeIndex + 1, options.length - 1))
        break
      case "ArrowUp":
        e.preventDefault()
        focusOption(Math.max(activeIndex - 1, 0))
        break
      case "Home":
        e.preventDefault()
        focusOption(0)
        break
      case "End":
        e.preventDefault()
        focusOption(options.length - 1)
        break
      case "Escape":
        e.preventDefault()
        closeMenu()
        triggerRef.current?.focus()
        break
      case "Tab":
        closeMenu()
        break
    }
  }

  return (
    <div className={className ? `block ${className}` : "block w-full"}>
      <button
        ref={triggerRef}
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        onClick={() => (open ? closeMenu() : openMenu())}
        onKeyDown={(e) => {
          if ((e.key === "ArrowDown" || e.key === "ArrowUp") && !open) {
            e.preventDefault()
            openMenu()
          }
        }}
        className="flex h-12 w-full cursor-pointer items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-sm shadow-sm outline-none transition-colors hover:border-slate-300 focus:border-slate-300"
      >
        <span
          className={`min-w-0 flex-1 truncate text-left ${
            selected ? "text-slate-800" : "text-slate-400"
          }`}
        >
          {selected ? selected.label : placeholder}
        </span>
        <ChevronDown
          className={`size-4 shrink-0 text-slate-400 transition-transform duration-200 ${
            open ? "rotate-180" : ""
          }`}
        />
      </button>

      {open && (
        <div
          ref={menuRef}
          id={menuId}
          role="listbox"
          aria-label={placeholder}
          onKeyDown={handleMenuKeyDown}
          onTransitionEnd={handleTransitionEnd}
          style={
            anchor
              ? {
                  left: anchor.left,
                  top: anchor.top,
                  width: anchor.width,
                  maxHeight: anchor.maxHeight,
                }
              : undefined
          }
          className={`fixed z-50 origin-top-left overflow-y-auto rounded-xl border border-slate-100 bg-white p-1.5 shadow-lg ring-1 ring-black/5 outline-none transition-all duration-100 ease-out ${
            visible && anchor ? "scale-100 opacity-100" : "pointer-events-none scale-95 opacity-0"
          }`}
        >
          {options.map((o, idx) => {
            const isSelected = o.value === value
            return (
              <button
                key={o.value}
                ref={(el) => {
                  optionRefs.current[idx] = el
                }}
                type="button"
                role="option"
                aria-selected={isSelected}
                onClick={() => {
                  onValueChange(o.value)
                  closeMenu()
                }}
                onMouseMove={() => setActiveIndex(idx)}
                className={`flex w-full cursor-pointer items-center justify-between gap-3 rounded-lg px-3 py-2 text-left text-sm transition-colors hover:bg-slate-50 focus:bg-slate-100 focus:outline-none ${
                  isSelected ? "font-semibold text-primary" : "text-slate-700"
                }`}
              >
                <span className="min-w-0 flex-1 truncate">{o.label}</span>
                {isSelected && <Check className="size-4 shrink-0 text-primary" />}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}

function MultiSelect({
  options,
  selected,
  onChange,
}: {
  options: string[]
  selected: string[]
  onChange: (val: string[]) => void
}) {
  const toggle = (val: string) => {
    onChange(
      selected.includes(val) ? selected.filter((v) => v !== val) : [...selected, val]
    )
  }

  return (
    <div className="flex flex-wrap gap-2">
      {options.map((opt) => (
        <button
          key={opt}
          type="button"
          onClick={() => toggle(opt)}
          className={`rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${
            selected.includes(opt)
              ? "border-primary bg-primary text-white"
              : "border-slate-200 bg-slate-50 text-slate-600 hover:border-slate-300"
          }`}
        >
          {opt}
        </button>
      ))}
    </div>
  )
}

/**
 * Whole-number input for non-negative counts ("Years in business", room count,
 * fleet size, group sizes, ...). Blocks the minus/exponent characters and
 * strips anything that is not a digit, so negative values can never be entered.
 */
function WholeNumberField(props: React.ComponentProps<typeof Input>) {
  const { onChange, onKeyDown, className, ...rest } = props
  return (
    <Input
      {...rest}
      type="number"
      inputMode="numeric"
      min={0}
      onKeyDown={(e) => {
        if (e.key === "-" || e.key === "+" || e.key === "e" || e.key === "E") {
          e.preventDefault()
        }
        onKeyDown?.(e)
      }}
      onChange={(e) => {
        if (!onChange) return
        const digits = e.target.value.replace(/\D/g, "")
        if (digits === e.target.value) {
          onChange(e)
          return
        }
        onChange({ ...e, target: { ...e.target, value: digits } } as React.ChangeEvent<HTMLInputElement>)
      }}
      className={cn(
        "[appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none",
        className
      )}
    />
  )
}

function FileUploadField({
  label,
  file,
  onChange,
  required,
}: {
  label: string
  file: File | null
  onChange: (f: File | null) => void
  required?: boolean
}) {
  const inputRef = useRef<HTMLInputElement>(null)

  return (
    <div>
      <FieldLabel required={required}>{label}</FieldLabel>
      {file ? (
        <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
          <span className="flex-1 truncate text-sm text-slate-700">{file.name}</span>
          <button
            type="button"
            onClick={() => onChange(null)}
            className="text-slate-400 hover:text-rose-500"
          >
            <X className="size-4" />
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className="flex w-full items-center justify-center gap-2 rounded-xl border-2 border-dashed border-slate-200 bg-slate-50 px-4 py-6 text-sm text-slate-500 transition-colors hover:border-primary hover:text-primary"
        >
          <Upload className="size-4" />
          Click to upload
        </button>
      )}
      <input
        ref={inputRef}
        type="file"
        className="hidden"
        accept="image/*,.pdf"
        onChange={(e) => onChange(e.target.files?.[0] ?? null)}
      />
    </div>
  )
}

/* ========================= Main Form ========================= */

export default function PartnerApplicationForm({
  partnerType,
  config,
  onBack,
}: PartnerApplicationFormProps) {
  const navigate = useNavigate()
  const comingSoon = useComingSoon()
  const { steps, initialForm, validateStep } = config
  const [step, setStep] = useState(0)
  const [direction, setDirection] = useState(1)
  const [form, setForm] = useState<Record<string, any>>({ ...initialForm })
  const [errors, setErrors] = useState<Record<string, string>>({})
  // The partner application is not wired to a backend yet: the submit button
  // is marked "coming soon", so these never change.
  const loading = false
  const success = false

  const progress = ((step + 1) / steps.length) * 100

  const setField = useCallback((key: string, value: any) => {
    setForm((prev) => ({ ...prev, [key]: value }))
  }, [])

  const validateCurrentStep = useCallback((): boolean => {
    const error = validateStep(steps[step].key, form)
    if (error) {
      setErrors({ [steps[step].key]: error })
      return false
    }
    setErrors({})
    return true
  }, [step, steps, form, validateStep])

  const handleNext = useCallback(() => {
    if (!validateCurrentStep()) return
    setDirection(1)
    setStep((prev) => Math.min(prev + 1, steps.length - 1))
    setErrors({})
  }, [validateCurrentStep, steps.length])

  const handleBack = useCallback(() => {
    setDirection(-1)
    setStep((prev) => Math.max(prev - 1, 0))
    setErrors({})
  }, [])

  const handleStepClick = useCallback(
    (idx: number) => {
      setDirection(idx > step ? 1 : -1)
      setStep(idx)
      setErrors({})
    },
    [step]
  )

  const stepCompleted = steps.map((s, i) => {
    if (i >= step) return false
    return validateStep(s.key, form) === null
  })

  const stepVariants = {
    enter: (dir: number) => ({ x: dir > 0 ? 80 : -80, opacity: 0 }),
    center: { x: 0, opacity: 1 },
    exit: (dir: number) => ({ x: dir > 0 ? -80 : 80, opacity: 0 }),
  }

  return (
    <>
      {/* PC top row: back button and step progress share one horizontal line */}
      <div className="mb-6 hidden items-center gap-4 lg:flex">
        <button
          type="button"
          onClick={() => (onBack ? onBack() : navigate("/partnerships"))}
          aria-label="Back"
          className="partner-apply-back partner-apply-back--row shrink-0"
        >
          <ArrowLeft size={18} />
        </button>
        <div className="flex-1">
          <div className="mb-2 flex items-center justify-end text-xs text-slate-500">
            Step {step + 1} of {steps.length}
          </div>
          <div className="h-1 overflow-hidden rounded-full bg-slate-100">
            <motion.div
              className="h-full rounded-full bg-primary"
              initial={false}
              animate={{ width: `${progress}%` }}
              transition={{ duration: 0.4, ease: "easeInOut" }}
            />
          </div>
        </div>
      </div>

      <div className="flex min-h-[600px] flex-col overflow-x-hidden lg:flex-row">
        {/* Left Sidebar — Step Indicator */}
        <div className="w-full shrink-0 border-b border-slate-200 bg-slate-50 p-4 lg:sticky lg:top-[64px] lg:h-[calc(100vh-64px)] lg:w-60 lg:overflow-y-auto lg:overflow-x-hidden lg:border-b-0 lg:border-r lg:p-6">
          {/* Mobile: compact grid that fits all steps */}
          <nav className="grid grid-cols-5 gap-1.5 lg:block lg:gap-1">
          {steps.map((s, idx) => {
            const Icon = s.icon
            const isActive = idx === step
            const isCompleted = stepCompleted[idx]
            return (
              <button
                key={s.key}
                type="button"
                onClick={() => handleStepClick(idx)}
                title={s.label}
                className={`flex flex-col items-center gap-1 rounded-lg px-1 py-2 text-center transition-colors lg:flex-row lg:whitespace-nowrap lg:px-3 lg:py-2.5 lg:text-left ${
                  isActive
                    ? "bg-white font-semibold text-primary shadow-sm"
                    : isCompleted
                      ? "text-slate-700 hover:bg-white/60"
                      : "text-slate-400 hover:bg-white/60"
                }`}
              >
                <span
                  className={`flex size-7 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
                    isActive
                      ? "bg-primary text-white"
                      : isCompleted
                        ? "bg-primary/10 text-primary"
                        : "bg-slate-200 text-slate-500"
                  }`}
                >
                  {isCompleted ? <CheckCircle2 className="size-3.5" /> : <Icon className="size-3.5" />}
                </span>
                <span className="text-[10px] leading-tight lg:min-w-0 lg:flex-1 lg:truncate lg:text-sm">{s.label}</span>
              </button>
            )
          })}
        </nav>
      </div>

      {/* Right Content */}
      <div className="flex flex-1 flex-col p-4 sm:p-6 lg:p-8">
        {/* Application type title */}
        <div className="mb-6">
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
            {config.title}
          </h1>
          <p className="mt-2 text-sm text-slate-500 sm:text-base">{config.subtitle}</p>
        </div>

        {/* Progress Bar (mobile only — desktop shows it in the top row next to the back button) */}
        <div className="mb-6 lg:hidden">
          <div className="mb-2 flex items-center justify-between text-xs text-slate-500">
            <span />
            <span>Step {step + 1} of {steps.length}</span>
          </div>
          <div className="h-1 overflow-hidden rounded-full bg-slate-100">
            <motion.div
              className="h-full rounded-full bg-primary"
              initial={false}
              animate={{ width: `${progress}%` }}
              transition={{ duration: 0.4, ease: "easeInOut" }}
            />
          </div>
        </div>

        {/* Step Content */}
        <div className="flex-1">
          <AnimatePresence mode="wait" custom={direction}>
            <motion.div
              key={steps[step].key}
              custom={direction}
              variants={stepVariants}
              initial="enter"
              animate="center"
              exit="exit"
              transition={{
                x: { type: "spring", stiffness: 300, damping: 30 },
                opacity: { duration: 0.15 },
              }}
            >
              {success ? (
                <div className="flex flex-col items-center py-16 text-center">
                  <div className="mb-4 flex size-16 items-center justify-center rounded-full bg-primary/10">
                    <CheckCircle2 className="size-8 text-primary" />
                  </div>
                  <h2 className="text-xl font-bold text-slate-900">Application Submitted!</h2>
                  <p className="mt-2 max-w-sm text-sm text-slate-500">
                    Thank you for your interest in partnering with Travio Ghana. Our team will
                    review your application and get back to you within 3-5 business days.
                  </p>
                  <Button
                    type="button"
                    className="mt-8"
                    onClick={() => navigate("/partnerships")}
                  >
                    Back to Partnerships
                  </Button>
                </div>
              ) : (
                <>
                  <p className="mb-6 text-sm font-semibold uppercase tracking-wide text-slate-400">
                    {steps[step].label}
                  </p>

                  <FormCard>
                    {renderStepContent(steps[step].key)}
                  </FormCard>
                </>
              )}
            </motion.div>
          </AnimatePresence>
        </div>

        {/* Errors */}
        {Object.values(errors)[0] && !success && (
          <div className="mt-4 flex items-start gap-2 rounded-xl border border-rose-100 bg-rose-50 px-4 py-3 text-sm text-rose-700">
            <AlertCircle className="mt-0.5 size-4 shrink-0" />
            <span>{Object.values(errors)[0]}</span>
          </div>
        )}

        {/* Navigation */}
        {!success && (
          <div className="mt-6 flex items-center justify-between">
            <Button
              type="button"
              variant="outline"
              onClick={handleBack}
              disabled={step === 0 || loading}
              className="h-11 px-5"
            >
              <ChevronLeft className="mr-1 size-4" />
              Back
            </Button>

            {step < steps.length - 1 ? (
              <Button
                type="button"
                onClick={handleNext}
                disabled={loading}
                className="h-11 px-5"
              >
                Continue
                <ChevronRight className="ml-1 size-4" />
              </Button>
            ) : (
              <Button
                type="button"
                disabled={!form.termsAccepted}
                className="h-11 px-5 is-coming-soon"
                {...comingSoon}
              >
                Submit Application
              </Button>
            )}
          </div>
        )}
      </div>
      </div>
    </>
  )

  /* ---------- Step content renderers ---------- */

  function renderStepContent(stepKey: string) {
    // Tour Operators
    if (partnerType === "tour-operators") {
      switch (stepKey) {
        case "business":
          return (
            <div className="space-y-5">
              <div>
                <FieldLabel required>Legal business name</FieldLabel>
                <Input
                  placeholder="Enter legal business name"
                  value={form.legalName || ""}
                  onChange={(e) => setField("legalName", e.target.value)}
                  className="h-12 rounded-xl text-base"
                />
              </div>
              <div>
                <FieldLabel required>Display / brand name</FieldLabel>
                <Input
                  placeholder="Name shown to travellers"
                  value={form.displayName || ""}
                  onChange={(e) => setField("displayName", e.target.value)}
                  className="h-12 rounded-xl text-base"
                />
              </div>
              <div>
                <FieldLabel required>Business type</FieldLabel>
                <DropdownSelect value={form.businessType || ""} onValueChange={(v) => setField("businessType", v)} placeholder="Select type">
                  {BUSINESS_TYPES_LIST.map((bt) => (
                    <option key={bt.value} value={bt.value}>{bt.label}</option>
                  ))}
                </DropdownSelect>
              </div>
              <div>
                <FieldLabel required>Country</FieldLabel>
                <DropdownSelect value={form.country || ""} onValueChange={(v) => setField("country", v)} placeholder="Select country">
                  {COUNTRIES.map((c) => (
                    <option key={c.code} value={c.code}>{c.name}</option>
                  ))}
                </DropdownSelect>
              </div>
              <div>
                <FieldLabel required>Full address</FieldLabel>
                <Input
                  placeholder="Street, area, city"
                  value={form.fullAddress || ""}
                  onChange={(e) => setField("fullAddress", e.target.value)}
                  className="h-12 rounded-xl text-base"
                />
              </div>
              <div>
                <FieldLabel required>Phone number</FieldLabel>
                <Input
                  placeholder="+233 ..."
                  value={form.phone || ""}
                  onChange={(e) => setField("phone", e.target.value)}
                  className="h-12 rounded-xl text-base"
                />
              </div>
              <div>
                <FieldLabel>Website</FieldLabel>
                <Input
                  type="url"
                  placeholder="https://..."
                  value={form.website || ""}
                  onChange={(e) => setField("website", e.target.value)}
                  className="h-12 rounded-xl text-base"
                />
              </div>
            </div>
          )

        case "operating":
          return (
            <div className="space-y-5">
              <div>
                <FieldLabel required>Tour categories</FieldLabel>
                <MultiSelect
                  options={TOUR_CATEGORIES}
                  selected={form.tourCategories || []}
                  onChange={(v) => setField("tourCategories", v)}
                />
              </div>
              <div>
                <FieldLabel required>Destinations</FieldLabel>
                <MultiSelect
                  options={["Greater Accra", "Ashanti", "Western", "Central", "Eastern", "Northern", "Volta", "Cape Coast", "Elmina"]}
                  selected={form.destinations || []}
                  onChange={(v) => setField("destinations", v)}
                />
              </div>
              <div>
                <FieldLabel>Languages</FieldLabel>
                <MultiSelect
                  options={LANGUAGES}
                  selected={form.languages || []}
                  onChange={(v) => setField("languages", v)}
                />
              </div>
              <div>
                <FieldLabel>Years in business</FieldLabel>
                <WholeNumberField
                  placeholder="e.g. 5"
                  value={form.yearsInBusiness || ""}
                  onChange={(e) => setField("yearsInBusiness", e.target.value)}
                  className="h-12 rounded-xl text-base"
                />
              </div>
              <div>
                <FieldLabel>Meeting style</FieldLabel>
                <DropdownSelect value={form.meetingStyle || ""} onValueChange={(v) => setField("meetingStyle", v)} placeholder="Select style">
                  {MEETING_STYLES.map((ms) => (
                    <option key={ms.value} value={ms.value}>{ms.label}</option>
                  ))}
                </DropdownSelect>
              </div>
              <div>
                <FieldLabel>Cancellation policy</FieldLabel>
                <DropdownSelect value={form.cancellationPolicy || ""} onValueChange={(v) => setField("cancellationPolicy", v)} placeholder="Select policy">
                  {CANCELLATION_POLICIES.map((cp) => (
                    <option key={cp.value} value={cp.value}>{cp.label}</option>
                  ))}
                </DropdownSelect>
              </div>
            </div>
          )

        case "representative":
          return (
            <div className="space-y-5">
              <div>
                <FieldLabel required>Full name</FieldLabel>
                <Input
                  placeholder="Contact person's full name"
                  value={form.repFullName || ""}
                  onChange={(e) => setField("repFullName", e.target.value)}
                  className="h-12 rounded-xl text-base"
                />
              </div>
              <div>
                <FieldLabel required>Email</FieldLabel>
                <Input
                  type="email"
                  placeholder="e.g. rep@email.com"
                  value={form.repEmail || ""}
                  onChange={(e) => setField("repEmail", e.target.value)}
                  className="h-12 rounded-xl text-base"
                />
              </div>
              <div>
                <FieldLabel>Date of birth</FieldLabel>
                <Input
                  type="date"
                  value={form.repDateOfBirth || ""}
                  onChange={(e) => setField("repDateOfBirth", e.target.value)}
                  className="h-12 rounded-xl text-base"
                />
              </div>
              <div>
                <FieldLabel>ID type</FieldLabel>
                <DropdownSelect value={form.repIdType || ""} onValueChange={(v) => setField("repIdType", v)} placeholder="Select ID type">
                  {ID_TYPES.map((id) => (
                    <option key={id.value} value={id.value}>{id.label}</option>
                  ))}
                </DropdownSelect>
              </div>
              <div>
                <FieldLabel>Full address</FieldLabel>
                <Input
                  placeholder="Representative's address"
                  value={form.repFullAddress || ""}
                  onChange={(e) => setField("repFullAddress", e.target.value)}
                  className="h-12 rounded-xl text-base"
                />
              </div>
            </div>
          )

        case "documents":
          return (
            <div className="space-y-5">
              <FileUploadField
                label="Identity document (Passport / National ID / Driver's License)"
                file={form.identityDoc}
                onChange={(f) => setField("identityDoc", f)}
                required
              />
              <FileUploadField
                label="Business license / registration"
                file={form.businessLicense}
                onChange={(f) => setField("businessLicense", f)}
              />
              <FileUploadField
                label="Proof of address"
                file={form.proofOfAddress}
                onChange={(f) => setField("proofOfAddress", f)}
              />
            </div>
          )

        case "compliance":
          return (
            <div className="space-y-6">
              <div className="rounded-xl bg-slate-50 p-4">
                <h4 className="mb-2 text-sm font-bold text-slate-700">Application Summary</h4>
                <div className="space-y-1 text-sm text-slate-600">
                  <p><span className="font-medium text-slate-500">Business:</span> {form.legalName || "—"}</p>
                  <p><span className="font-medium text-slate-500">Display:</span> {form.displayName || "—"}</p>
                  <p><span className="font-medium text-slate-500">Country:</span> {COUNTRIES.find((c) => c.code === form.country)?.name || "—"}</p>
                  <p><span className="font-medium text-slate-500">Address:</span> {form.fullAddress || "—"}</p>
                  <p><span className="font-medium text-slate-500">Phone:</span> {form.phone || "—"}</p>
                  <p><span className="font-medium text-slate-500">Contact:</span> {form.repFullName || "—"} ({form.repEmail || "—"})</p>
                </div>
              </div>
              <label className="flex items-start gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.termsAccepted || false}
                  onChange={(e) => setField("termsAccepted", e.target.checked)}
                  className="mt-0.5 size-4 rounded border-slate-300 text-primary focus:ring-primary"
                />
                <span className="text-sm text-slate-600">
                  I confirm that the information provided is accurate and I agree to the{" "}
                  <span className="font-semibold text-primary">Terms of Service</span> and{" "}
                  <span className="font-semibold text-primary">Privacy Policy</span> of Travio Ghana.
                </span>
              </label>
            </div>
          )
      }
    }

    // Other partner types
    switch (stepKey) {
      // ---- Shared: Basic Info ----
      case "basic":
        return (
          <div className="space-y-5">
            <div>
              <FieldLabel required>Full name</FieldLabel>
              <Input
                placeholder="Enter full name"
                value={form.fullName || ""}
                onChange={(e) => setField("fullName", e.target.value)}
                className="h-12 rounded-xl text-base"
              />
            </div>
            <div>
              <FieldLabel required>Email</FieldLabel>
              <Input
                type="email"
                placeholder="e.g. youremail@gmail.com"
                value={form.email || ""}
                onChange={(e) => setField("email", e.target.value)}
                className="h-12 rounded-xl text-base"
              />
            </div>
            <div>
              <FieldLabel required>Phone number</FieldLabel>
              <div className="flex gap-2">
                <DropdownSelect
                  value={form.phoneCode || "+233"}
                  onValueChange={(v) => setField("phoneCode", v)}
                  className="w-44 shrink-0"
                >
                  {PHONE_CODES.map((pc) => (
                    <option key={pc.code} value={pc.code}>
                      {pc.label}
                    </option>
                  ))}
                </DropdownSelect>
                <Input
                  placeholder="000 000 000"
                  value={form.phoneNumber || ""}
                  onChange={(e) => setField("phoneNumber", e.target.value)}
                  className="h-12 flex-1 rounded-xl text-base"
                />
              </div>
            </div>
            <div>
              <FieldLabel required>Location</FieldLabel>
              <DropdownSelect
                value={form.location || ""}
                onValueChange={(v) => setField("location", v)}
                placeholder="Select city"
              >
                <option value="Accra">Accra</option>
                <option value="Kumasi">Kumasi</option>
                <option value="Cape Coast">Cape Coast</option>
                <option value="Takoradi">Takoradi</option>
                <option value="Tamale">Tamale</option>
                <option value="Tema">Tema</option>
              </DropdownSelect>
              <p className="mt-1 flex items-center gap-1 text-xs text-slate-400">
                <AlertCircle className="size-3" />
                City you operate from most often.
              </p>
            </div>
          </div>
        )

      // ---- Tour Operators ----
      case "business":
        return (
          <div className="space-y-5">
            <div>
              <FieldLabel required>Company name</FieldLabel>
              <Input
                placeholder="Enter company name"
                value={form.companyName || ""}
                onChange={(e) => setField("companyName", e.target.value)}
                className="h-12 rounded-xl text-base"
              />
            </div>
            <div>
              <FieldLabel required>Business type</FieldLabel>
              <DropdownSelect
                value={form.businessType || ""}
                onValueChange={(v) => setField("businessType", v)}
                placeholder="Select type"
              >
                <option value="individual">Individual / Sole Proprietor</option>
                <option value="company">Company / Corporation</option>
                <option value="non_profit">Non-Profit Organization</option>
              </DropdownSelect>
            </div>
            <div>
              <FieldLabel>Years in operation</FieldLabel>
                <WholeNumberField
                  placeholder="e.g. 5"
                  value={form.yearsInOperation || ""}
                  onChange={(e) => setField("yearsInOperation", e.target.value)}
                  className="h-12 rounded-xl text-base"
                />
            </div>
            <div>
              <FieldLabel>Website</FieldLabel>
              <Input
                type="url"
                placeholder="https://..."
                value={form.website || ""}
                onChange={(e) => setField("website", e.target.value)}
                className="h-12 rounded-xl text-base"
              />
            </div>
          </div>
        )

      case "tours":
        return (
          <div className="space-y-5">
            <div>
              <FieldLabel required>Tour categories</FieldLabel>
              <MultiSelect
                options={TOUR_CATEGORIES}
                selected={form.tourCategories || []}
                onChange={(v) => setField("tourCategories", v)}
              />
            </div>
            <div>
              <FieldLabel required>Destinations</FieldLabel>
              <MultiSelect
                options={["Greater Accra", "Ashanti", "Western", "Central", "Eastern", "Northern", "Volta", "Cape Coast", "Elmina"]}
                selected={form.destinations || []}
                onChange={(v) => setField("destinations", v)}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <FieldLabel>Min group size</FieldLabel>
                <WholeNumberField
                  placeholder="1"
                  value={form.groupSizeMin || ""}
                  onChange={(e) => setField("groupSizeMin", e.target.value)}
                  className="h-12 rounded-xl text-base"
                />
              </div>
              <div>
                <FieldLabel>Max group size</FieldLabel>
                <WholeNumberField
                  placeholder="20"
                  value={form.groupSizeMax || ""}
                  onChange={(e) => setField("groupSizeMax", e.target.value)}
                  className="h-12 rounded-xl text-base"
                />
              </div>
            </div>
            <div>
              <FieldLabel>Price range (USD per person)</FieldLabel>
              <DropdownSelect value={form.priceRange || ""} onValueChange={(v) => setField("priceRange", v)} placeholder="Select range">
                <option value="budget">Under $50</option>
                <option value="mid">$50 - $150</option>
                <option value="premium">$150 - $500</option>
                <option value="luxury">$500+</option>
              </DropdownSelect>
            </div>
          </div>
        )

      // ---- Hotels ----
      case "property":
        return (
          <div className="space-y-5">
            <div>
              <FieldLabel required>Property name</FieldLabel>
              <Input
                placeholder="Enter property name"
                value={form.propertyName || ""}
                onChange={(e) => setField("propertyName", e.target.value)}
                className="h-12 rounded-xl text-base"
              />
            </div>
            <div>
              <FieldLabel required>Star rating</FieldLabel>
              <DropdownSelect value={form.starRating || ""} onValueChange={(v) => setField("starRating", v)} placeholder="Select rating">
                <option value="2">2 Star</option>
                <option value="3">3 Star</option>
                <option value="4">4 Star</option>
                <option value="5">5 Star</option>
              </DropdownSelect>
            </div>
            <div>
              <FieldLabel>Number of rooms</FieldLabel>
                <WholeNumberField
                  placeholder="e.g. 30"
                  value={form.numberOfRooms || ""}
                  onChange={(e) => setField("numberOfRooms", e.target.value)}
                  className="h-12 rounded-xl text-base"
                />
            </div>
            <div>
              <FieldLabel>Amenities</FieldLabel>
              <MultiSelect
                options={AMENITIES}
                selected={form.amenities || []}
                onChange={(v) => setField("amenities", v)}
              />
            </div>
          </div>
        )

      case "location":
        return (
          <div className="space-y-5">
            <div>
              <FieldLabel required>Full address</FieldLabel>
              <Input
                placeholder="Street address, area, city"
                value={form.fullAddress || ""}
                onChange={(e) => setField("fullAddress", e.target.value)}
                className="h-12 rounded-xl text-base"
              />
            </div>
            <div>
              <FieldLabel>GPS coordinates</FieldLabel>
              <Input
                placeholder="e.g. 5.6037, -0.1870"
                value={form.gpsCoordinates || ""}
                onChange={(e) => setField("gpsCoordinates", e.target.value)}
                className="h-12 rounded-xl text-base"
              />
            </div>
            <div>
              <FieldLabel>Front desk phone</FieldLabel>
              <Input
                placeholder="Direct line to front desk"
                value={form.frontDeskPhone || ""}
                onChange={(e) => setField("frontDeskPhone", e.target.value)}
                className="h-12 rounded-xl text-base"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <FieldLabel>Check-in time</FieldLabel>
                <Input
                  type="time"
                  value={form.checkInTime || ""}
                  onChange={(e) => setField("checkInTime", e.target.value)}
                  className="h-12 rounded-xl text-base"
                />
              </div>
              <div>
                <FieldLabel>Check-out time</FieldLabel>
                <Input
                  type="time"
                  value={form.checkOutTime || ""}
                  onChange={(e) => setField("checkOutTime", e.target.value)}
                  className="h-12 rounded-xl text-base"
                />
              </div>
            </div>
          </div>
        )

      // ---- Travel Agents ----
      case "agency":
        return (
          <div className="space-y-5">
            <div>
              <FieldLabel required>Agency name</FieldLabel>
              <Input
                placeholder="Enter agency name"
                value={form.agencyName || ""}
                onChange={(e) => setField("agencyName", e.target.value)}
                className="h-12 rounded-xl text-base"
              />
            </div>
            <div>
              <FieldLabel required>License number</FieldLabel>
              <Input
                placeholder="Travel agency license number"
                value={form.licenseNumber || ""}
                onChange={(e) => setField("licenseNumber", e.target.value)}
                className="h-12 rounded-xl text-base"
              />
            </div>
            <div>
              <FieldLabel>Years in business</FieldLabel>
              <WholeNumberField
                placeholder="e.g. 3"
                value={form.yearsInBusiness || ""}
                onChange={(e) => setField("yearsInBusiness", e.target.value)}
                className="h-12 rounded-xl text-base"
              />
            </div>
            <div>
              <FieldLabel>Markets served</FieldLabel>
              <MultiSelect
                options={["Local (Domestic)", "Inbound (International)", "Outbound", "Corporate", "MICE"]}
                selected={form.marketsServed || []}
                onChange={(v) => setField("marketsServed", v)}
              />
            </div>
          </div>
        )

      case "channels":
        return (
          <div className="space-y-5">
            <div>
              <FieldLabel>Online platforms</FieldLabel>
              <Input
                placeholder="Website, OTAs, booking platforms..."
                value={form.onlinePlatforms || ""}
                onChange={(e) => setField("onlinePlatforms", e.target.value)}
                className="h-12 rounded-xl text-base"
              />
            </div>
            <div>
              <FieldLabel>Retail locations</FieldLabel>
              <Input
                placeholder="Office addresses, storefronts..."
                value={form.retailLocations || ""}
                onChange={(e) => setField("retailLocations", e.target.value)}
                className="h-12 rounded-xl text-base"
              />
            </div>
            <div>
              <FieldLabel>Preferred commission structure</FieldLabel>
              <DropdownSelect value={form.commissionStructure || ""} onValueChange={(v) => setField("commissionStructure", v)} placeholder="Select structure">
                <option value="fixed">Fixed commission per booking</option>
                <option value="percentage">Percentage of booking value</option>
                <option value="tiered">Tiered (volume-based)</option>
                <option value="flexible">Open to negotiation</option>
              </DropdownSelect>
            </div>
          </div>
        )

      // ---- Transport Providers ----
      case "fleet":
        return (
          <div className="space-y-5">
            <div>
              <FieldLabel required>Vehicle types</FieldLabel>
              <MultiSelect
                options={VEHICLE_TYPES}
                selected={form.vehicleTypes || []}
                onChange={(v) => setField("vehicleTypes", v)}
              />
            </div>
            <div>
              <FieldLabel required>Fleet size</FieldLabel>
                <WholeNumberField
                  placeholder="Number of vehicles"
                  value={form.fleetSize || ""}
                  onChange={(e) => setField("fleetSize", e.target.value)}
                  className="h-12 rounded-xl text-base"
                />
            </div>
            <div>
              <FieldLabel>Passenger capacity (per vehicle)</FieldLabel>
                <WholeNumberField
                  placeholder="e.g. 12"
                  value={form.passengerCapacity || ""}
                  onChange={(e) => setField("passengerCapacity", e.target.value)}
                  className="h-12 rounded-xl text-base"
                />
            </div>
          </div>
        )

      case "areas":
        return (
          <div className="space-y-5">
            <div>
              <FieldLabel required>Primary routes</FieldLabel>
              <Input
                placeholder="e.g. Accra - Kumasi, Accra - Cape Coast"
                value={form.primaryRoutes || ""}
                onChange={(e) => setField("primaryRoutes", e.target.value)}
                className="h-12 rounded-xl text-base"
              />
            </div>
            <div>
              <FieldLabel>Coverage regions</FieldLabel>
              <MultiSelect
                options={COVERAGE_REGIONS}
                selected={form.coverageRegions || []}
                onChange={(v) => setField("coverageRegions", v)}
              />
            </div>
            <div>
              <FieldLabel>Pricing model</FieldLabel>
              <DropdownSelect value={form.pricingModel || ""} onValueChange={(v) => setField("pricingModel", v)} placeholder="Select pricing model">
                <option value="fixed">Fixed price per route</option>
                <option value="per_km">Per kilometer</option>
                <option value="hourly">Hourly charter</option>
                <option value="negotiable">Negotiable</option>
              </DropdownSelect>
            </div>
          </div>
        )

      // ---- Documents (shared structure, different requirements per type) ----
      case "documents":
        return (
          <div className="space-y-5">
            <FileUploadField
              label="Business License / Registration"
              file={form.businessLicense}
              onChange={(f) => setField("businessLicense", f)}
              required
            />
            {partnerType === "tour-operators" && (
              <>
                <FileUploadField
                  label="Tourism Authority Certificate"
                  file={form.tourismCertificate}
                  onChange={(f) => setField("tourismCertificate", f)}
                />
                <FileUploadField
                  label="Insurance Certificate"
                  file={form.insurance}
                  onChange={(f) => setField("insurance", f)}
                />
              </>
            )}
            {partnerType === "hotels" && (
              <>
                <FileUploadField
                  label="Health & Safety Certificate"
                  file={form.healthCertificate}
                  onChange={(f) => setField("healthCertificate", f)}
                />
                <FileUploadField
                  label="Fire Safety Certificate"
                  file={form.fireSafetyCert}
                  onChange={(f) => setField("fireSafetyCert", f)}
                />
              </>
            )}
            {partnerType === "travel-agents" && (
              <>
                <FileUploadField
                  label="Business Registration"
                  file={form.businessRegistration}
                  onChange={(f) => setField("businessRegistration", f)}
                />
                <FileUploadField
                  label="Proof of Address"
                  file={form.proofOfAddress}
                  onChange={(f) => setField("proofOfAddress", f)}
                />
              </>
            )}
            {partnerType === "transport-providers" && (
              <>
                <FileUploadField
                  label="Vehicle Registration"
                  file={form.vehicleRegistration}
                  onChange={(f) => setField("vehicleRegistration", f)}
                />
                <FileUploadField
                  label="Insurance Certificate"
                  file={form.insurance}
                  onChange={(f) => setField("insurance", f)}
                />
                <FileUploadField
                  label="Driver's License"
                  file={form.driverLicense}
                  onChange={(f) => setField("driverLicense", f)}
                />
                <FileUploadField
                  label="Roadworthiness Certificate"
                  file={form.roadworthinessCert}
                  onChange={(f) => setField("roadworthinessCert", f)}
                />
              </>
            )}
          </div>
        )

      // ---- Review & Submit (shared) ----
      case "review":
        return (
          <div className="space-y-6">
            <div className="rounded-xl bg-slate-50 p-4">
              <h4 className="mb-2 text-sm font-bold text-slate-700">Application Summary</h4>
              <div className="space-y-1 text-sm text-slate-600">
                <p><span className="font-medium text-slate-500">Name:</span> {form.fullName || "—"}</p>
                <p><span className="font-medium text-slate-500">Email:</span> {form.email || "—"}</p>
                <p><span className="font-medium text-slate-500">Phone:</span> {form.phoneCode} {form.phoneNumber || "—"}</p>
                <p><span className="font-medium text-slate-500">Location:</span> {form.location || "—"}</p>
              </div>
            </div>
            <label className="flex items-start gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={form.termsAccepted || false}
                onChange={(e) => setField("termsAccepted", e.target.checked)}
                className="mt-0.5 size-4 rounded border-slate-300 text-primary focus:ring-primary"
              />
              <span className="text-sm text-slate-600">
                I confirm that the information provided is accurate and I agree to the{" "}
                <span className="font-semibold text-primary">Terms of Service</span> and{" "}
                <span className="font-semibold text-primary">Privacy Policy</span> of Travio Ghana.
              </span>
            </label>
          </div>
        )

      default:
        return null
    }
  }
}
