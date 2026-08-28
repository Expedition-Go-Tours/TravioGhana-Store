import { useState, useRef, useEffect } from 'react'
import { Check, HelpCircle, ChevronDown } from 'lucide-react'

export function FieldLabel({ children, required, tooltip }: { children: React.ReactNode; required?: boolean; tooltip?: string }) {
  const [showTooltip, setShowTooltip] = useState(false)
  const tooltipRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!showTooltip) return
    const handleClickOutside = (e: MouseEvent) => {
      if (tooltipRef.current && !tooltipRef.current.contains(e.target as Node)) {
        setShowTooltip(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [showTooltip])

  return (
    <label className="mb-1.5 flex items-center gap-1 text-sm font-semibold text-slate-700">
      {children}
      {required && <span className="text-rose-500">*</span>}
      {tooltip && (
        <span className="relative inline-flex">
          <button
            type="button"
            onClick={() => setShowTooltip((v) => !v)}
            className="text-slate-400 hover:text-slate-600 transition-colors"
            aria-label="More information"
          >
            <HelpCircle className="size-3.5" />
          </button>
          {showTooltip && (
            <div
              ref={tooltipRef}
              className="absolute top-full left-1/2 -translate-x-1/2 mt-2 z-50 w-56 rounded-lg bg-slate-900 px-3 py-2 text-xs font-normal text-white shadow-lg"
            >
              <p>{tooltip}</p>
              <div className="absolute bottom-full left-1/2 -translate-x-1/2 border-4 border-transparent border-b-slate-900" />
            </div>
          )}
        </span>
      )}
    </label>
  )
}

interface TextInputProps {
  value: string
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void
  onBlur?: () => void
  placeholder?: string
  type?: string
  valid?: boolean
  disabled?: boolean
  maxLength?: number
  error?: string
}

export function TextInput({ value, onChange, onBlur, placeholder, type = 'text', valid, disabled, maxLength, error }: TextInputProps) {
  return (
    <div className="relative">
      <input
        type={type}
        value={value}
        onChange={onChange}
        onBlur={onBlur}
        disabled={disabled}
        placeholder={placeholder}
        maxLength={maxLength}
        className={`w-full rounded-xl border bg-white px-4 py-3 text-sm text-slate-900 shadow-sm outline-none transition placeholder:text-slate-400 focus:ring-2 ${
          error
            ? 'border-rose-300 focus:border-rose-400 focus:ring-rose-100'
            : valid
              ? 'border-emerald-300 focus:border-emerald-400 focus:ring-emerald-100'
              : 'border-slate-200 focus:border-[#179237] focus:ring-[#179237]/15'
        } ${disabled ? 'cursor-not-allowed bg-slate-50 text-slate-400' : ''}`}
      />
      {valid && !error && (
        <Check className="absolute right-3 top-1/2 size-4 -translate-y-1/2 text-emerald-500" />
      )}
      {error && (
        <p className="mt-1 text-xs text-rose-500">{error}</p>
      )}
    </div>
  )
}

interface SelectInputProps {
  value: string
  onChange: (e: React.ChangeEvent<HTMLSelectElement>) => void
  options: { label: string; value: string }[]
  error?: string
}

export function SelectInput({ value, onChange, options, error }: SelectInputProps) {
  return (
    <div className="relative">
      <select
        value={value}
        onChange={onChange}
        className={`w-full appearance-none rounded-xl border bg-white px-4 py-3 pr-10 text-sm text-slate-900 shadow-sm outline-none transition focus:ring-2 [color-scheme:light] ${
          error
            ? 'border-rose-300 focus:border-rose-400 focus:ring-rose-100'
            : 'border-slate-200 focus:border-[#179237] focus:ring-[#179237]/15'
        }`}
      >
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
      <ChevronDown className="pointer-events-none absolute right-3.5 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
      {error && (
        <p className="mt-1 text-xs text-rose-500">{error}</p>
      )}
    </div>
  )
}
