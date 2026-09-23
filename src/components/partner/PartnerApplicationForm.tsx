/**
 * Multi-step partner application form.
 * Shared across all 5 partner types with custom steps per type.
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
  CONTENT_NICHES,
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

/* ---------- Social Platform Icons ---------- */

const SOCIAL_PLATFORMS = [
  {
    id: "x",
    name: "X",
    baseUrl: "x.com/",
    icon: (
      <svg viewBox="0 0 24 24" className="size-5" fill="currentColor">
        <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
      </svg>
    ),
    color: "bg-black text-white",
    hoverColor: "hover:bg-gray-800",
  },
  {
    id: "instagram",
    name: "Instagram",
    baseUrl: "instagram.com/",
    icon: (
      <svg viewBox="0 0 24 24" className="size-5" fill="currentColor">
        <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z" />
      </svg>
    ),
    color: "bg-gradient-to-br from-purple-500 via-pink-500 to-orange-400 text-white",
    hoverColor: "hover:from-purple-600 hover:via-pink-600 hover:to-orange-500",
  },
  {
    id: "facebook",
    name: "Facebook",
    baseUrl: "facebook.com/",
    icon: (
      <svg viewBox="0 0 24 24" className="size-5" fill="currentColor">
        <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
      </svg>
    ),
    color: "bg-[#1877F2] text-white",
    hoverColor: "hover:bg-[#166FE5]",
  },
  {
    id: "tiktok",
    name: "TikTok",
    baseUrl: "tiktok.com/@",
    icon: (
      <svg viewBox="0 0 24 24" className="size-5" fill="currentColor">
        <path d="M12.525.02c1.31-.02 2.61-.01 3.91-.02.08 1.53.63 3.09 1.75 4.17 1.12 1.11 2.7 1.62 4.24 1.79v4.03c-1.44-.05-2.89-.35-4.2-.97-.57-.26-1.1-.59-1.62-.93-.01 2.92.01 5.84-.02 8.75-.08 1.4-.54 2.79-1.35 3.94-1.31 1.92-3.58 3.17-5.91 3.21-1.43.08-2.86-.31-4.08-1.03-2.02-1.19-3.44-3.37-3.65-5.71-.02-.5-.03-1-.01-1.49.18-1.9 1.12-3.72 2.58-4.96 1.66-1.44 3.98-2.13 6.15-1.72.02 1.48-.04 2.96-.04 4.44-.99-.32-2.15-.23-3.02.37-.63.41-1.11 1.04-1.36 1.75-.21.51-.15 1.07-.14 1.61.24 1.64 1.82 3.02 3.5 2.87 1.12-.01 2.19-.66 2.77-1.61.19-.33.4-.67.41-1.06.1-1.79.06-3.57.07-5.36.01-4.03-.01-8.05.02-12.07z" />
      </svg>
    ),
    color: "bg-black text-white",
    hoverColor: "hover:bg-gray-800",
  },
  {
    id: "youtube",
    name: "YouTube",
    baseUrl: "youtube.com/@",
    icon: (
      <svg viewBox="0 0 24 24" className="size-5" fill="currentColor">
        <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" />
      </svg>
    ),
    color: "bg-[#FF0000] text-white",
    hoverColor: "hover:bg-[#E60000]",
  },
  {
    id: "linkedin",
    name: "LinkedIn",
    baseUrl: "linkedin.com/in/",
    icon: (
      <svg viewBox="0 0 24 24" className="size-5" fill="currentColor">
        <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
      </svg>
    ),
    color: "bg-[#0A66C2] text-white",
    hoverColor: "hover:bg-[#0958A8]",
  },
  {
    id: "whatsapp",
    name: "WhatsApp",
    baseUrl: "wa.me/",
    icon: (
      <svg viewBox="0 0 24 24" className="size-5" fill="currentColor">
        <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
      </svg>
    ),
    color: "bg-[#25D366] text-white",
    hoverColor: "hover:bg-[#20BD5A]",
  },
  {
    id: "pinterest",
    name: "Pinterest",
    baseUrl: "pinterest.com/",
    icon: (
      <svg viewBox="0 0 24 24" className="size-5" fill="currentColor">
        <path d="M12.017 0C5.396 0 .029 5.367.029 11.987c0 5.079 3.158 9.417 7.618 11.162-.105-.949-.199-2.403.041-3.439.219-.937 1.406-5.957 1.406-5.957s-.359-.72-.359-1.781c0-1.668.967-2.914 2.171-2.914 1.023 0 1.518.769 1.518 1.69 0 1.029-.655 2.568-.994 3.995-.283 1.194.599 2.169 1.777 2.169 2.133 0 3.772-2.249 3.772-5.495 0-2.873-2.064-4.882-5.012-4.882-3.414 0-5.418 2.561-5.418 5.207 0 1.031.397 2.138.893 2.738a.36.36 0 01.083.345l-.333 1.36c-.053.22-.174.267-.402.161-1.499-.698-2.436-2.889-2.436-4.649 0-3.785 2.75-7.262 7.929-7.262 4.163 0 7.398 2.967 7.398 6.931 0 4.136-2.607 7.464-6.227 7.464-1.216 0-2.359-.631-2.75-1.378l-.748 2.853c-.271 1.043-1.002 2.35-1.492 3.146C9.57 23.812 10.763 24 12.017 24c6.624 0 11.99-5.367 11.99-11.988C24.007 5.367 18.641 0 12.017 0z" />
      </svg>
    ),
    color: "bg-[#E60023] text-white",
    hoverColor: "hover:bg-[#CC0020]",
  },
]

function SocialPlatformsGrid({
  socialLinks,
  onChange,
}: {
  socialLinks: Record<string, string>
  onChange: (platform: string, handle: string) => void
}) {
  const [expandedPlatform, setExpandedPlatform] = useState<string | null>(null)

  return (
    <div className="grid grid-cols-2 gap-3">
      {SOCIAL_PLATFORMS.map((platform) => {
        const isExpanded = expandedPlatform === platform.id
        const hasValue = socialLinks[platform.id]?.trim()

        return (
          <div key={platform.id} className="relative">
            <button
              type="button"
              onClick={() => setExpandedPlatform(isExpanded ? null : platform.id)}
              className={`w-full rounded-xl border-2 p-4 transition-all ${
                hasValue
                  ? "border-primary bg-primary/5"
                  : isExpanded
                    ? "border-primary bg-white shadow-md"
                    : "border-slate-200 bg-white hover:border-slate-300 hover:shadow-sm"
              }`}
            >
              <div className="flex items-center gap-3">
                <div className={`flex size-10 shrink-0 items-center justify-center rounded-lg ${platform.color}`}>
                  {platform.icon}
                </div>
                <div className="min-w-0 text-left">
                  <div className="text-sm font-semibold text-slate-800">{platform.name}</div>
                  <div className="text-xs text-slate-400 truncate">{platform.baseUrl}{hasValue || ""}</div>
                </div>
              </div>
            </button>

            <AnimatePresence>
              {isExpanded && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  className="overflow-hidden"
                >
                  <div className="pt-2">
                    <div className="flex items-center rounded-lg border border-slate-200 bg-white">
                      <span className="pl-3 text-xs text-slate-400 whitespace-nowrap">{platform.baseUrl}</span>
                      <input
                        type="text"
                        placeholder="handle"
                        value={socialLinks[platform.id] || ""}
                        onChange={(e) => onChange(platform.id, e.target.value)}
                        className="w-full rounded-r-lg border-0 bg-transparent px-2 py-2.5 text-base text-slate-800 placeholder:text-slate-300 focus:outline-none focus:ring-0"
                        autoFocus
                      />
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )
      })}
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

      // ---- Content Creators ----
      case "identity":
        return (
          <div className="space-y-5">
            <div>
              <FieldLabel required>Creator / display name</FieldLabel>
              <Input
                placeholder="e.g. adacreates"
                value={form.displayName || ""}
                onChange={(e) => setField("displayName", e.target.value)}
                className="h-12 rounded-xl text-base"
              />
            </div>
            <div>
              <FieldLabel required>Content niche</FieldLabel>
              <DropdownSelect value={form.contentNiche || ""} onValueChange={(v) => setField("contentNiche", v)} placeholder="Select niche">
                {CONTENT_NICHES.map((n) => (
                  <option key={n} value={n}>{n}</option>
                ))}
              </DropdownSelect>
            </div>
            <div>
              <FieldLabel>Audience size (total followers)</FieldLabel>
              <DropdownSelect value={form.audienceSize || ""} onValueChange={(v) => setField("audienceSize", v)} placeholder="Select range">
                <option value="nano">Under 1K</option>
                <option value="micro">1K - 10K</option>
                <option value="mid">10K - 100K</option>
                <option value="macro">100K - 500K</option>
                <option value="mega">500K+</option>
              </DropdownSelect>
            </div>
          </div>
        )

      case "socials":
        return (
          <div className="space-y-6">
            <div>
              <h3 className="text-base font-semibold text-slate-800">Add Social Media</h3>
              <p className="text-sm text-slate-500">Choose a platform</p>
            </div>
            <SocialPlatformsGrid
              socialLinks={form.socialLinks || {}}
              onChange={(platform, handle) => {
                const updated = { ...(form.socialLinks || {}), [platform]: handle }
                setField("socialLinks", updated)
              }}
            />
            <div>
              <FieldLabel>Content type</FieldLabel>
              <MultiSelect
                options={["Photos", "Reels / Short-form", "Long-form Video", "Blog Posts", "Stories", "Podcasts"]}
                selected={form.contentType || []}
                onChange={(v) => setField("contentType", v)}
              />
            </div>
            <div>
              <FieldLabel>Portfolio URL</FieldLabel>
              <Input
                placeholder="Link to portfolio or media kit"
                value={form.portfolioUrl || ""}
                onChange={(e) => setField("portfolioUrl", e.target.value)}
                className="h-12 rounded-xl text-base"
              />
            </div>
          </div>
        )

      case "interests":
        return (
          <div className="space-y-5">
            <div>
              <FieldLabel>Preferred campaign types</FieldLabel>
              <MultiSelect
                options={["Sponsored trips", "Product reviews", "Brand ambassador", "Content creation", "Event coverage", "Takeovers"]}
                selected={form.preferredCampaigns || []}
                onChange={(v) => setField("preferredCampaigns", v)}
              />
            </div>
            <div>
              <FieldLabel>Availability</FieldLabel>
              <DropdownSelect value={form.availability || ""} onValueChange={(v) => setField("availability", v)} placeholder="Select availability">
                <option value="full_time">Full-time (available anytime)</option>
                <option value="part_time">Part-time (weekends/flexible)</option>
                <option value="quarterly">Quarterly (few trips per year)</option>
                <option value="custom">Custom arrangement</option>
              </DropdownSelect>
            </div>
            <div>
              <FieldLabel>Rate expectations</FieldLabel>
              <DropdownSelect value={form.rateExpectations || ""} onValueChange={(v) => setField("rateExpectations", v)} placeholder="Select rate preference">
                <option value="per_trip">Per trip / experience</option>
                <option value="per_post">Per post / content piece</option>
                <option value="monthly">Monthly retainer</option>
                <option value="commission">Commission-based</option>
                <option value="flexible">Open to discussion</option>
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
