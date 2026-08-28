import { useMemo, useState } from "react"
import { CalendarDays, ChevronDown } from "lucide-react"

import { cn } from "@/lib/utils"
import { CalendarPicker } from "@/components/ui/apple-calendar-picker"

/** Value is stored as yyyy-MM-dd. */
export const STORAGE_DATE_FORMAT = "yyyy-MM-dd"
export const DISPLAY_DATE_FORMAT = "dd-MM-yyyy"

export function parseStoredDate(value?: string): Date | undefined {
  if (!value) return undefined
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value)
  if (!match) return undefined
  const [, y, m, d] = match
  const date = new Date(Number(y), Number(m) - 1, Number(d))
  if (Number.isNaN(date.getTime())) return undefined
  return date
}

export function formatDateForStorage(date: Date): string {
  if (!date || Number.isNaN(date.getTime())) return ""
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, "0")
  const d = String(date.getDate()).padStart(2, "0")
  return `${y}-${m}-${d}`
}

export function formatDateForDisplay(value?: string): string {
  const date = parseStoredDate(value)
  if (!date) return ""
  const d = String(date.getDate()).padStart(2, "0")
  const m = String(date.getMonth() + 1).padStart(2, "0")
  return `${d}-${m}-${date.getFullYear()}`
}

interface DatePickerProps {
  value?: string
  onChange: (value: string) => void
  placeholder?: string
  disabled?: boolean
  /** Ignored: the calendar only allows dates in the past (date of birth). */
  maxDate?: Date
  /** Ignored: the calendar only allows dates in the past (date of birth). */
  minDate?: Date
  className?: string
  id?: string
}

export function DatePicker({
  value = "",
  onChange,
  placeholder = "dd-mm-yyyy",
  disabled = false,
  className,
  id,
}: DatePickerProps) {
  const [open, setOpen] = useState(false)
  const selected = useMemo(() => parseStoredDate(value), [value])

  return (
    <div className={cn("relative", className)}>
      <button
        type="button"
        id={id}
        disabled={disabled}
        onClick={() => setOpen((o) => !o)}
        className={cn(
          "flex h-12 w-full items-center justify-between rounded-[1.4rem] border border-input bg-white px-4 text-sm text-foreground shadow-sm shadow-black/5 transition-colors",
          "focus-visible:outline-none focus-visible:border-ring focus-visible:ring-4 focus-visible:ring-ring/20",
          "disabled:cursor-not-allowed disabled:opacity-50",
          value ? "text-foreground" : "text-muted-foreground"
        )}
      >
        <span className="flex min-w-0 items-center gap-2">
          <CalendarDays className="size-4 shrink-0 text-muted-foreground" />
          <span className="truncate">{value ? formatDateForDisplay(value) : placeholder}</span>
        </span>
        <ChevronDown className="size-4 shrink-0 text-muted-foreground" />
      </button>

      <CalendarPicker
        isOpen={open}
        onClose={() => setOpen(false)}
        selectedDate={selected ?? null}
        onDateSelect={(date: Date) => {
          onChange(formatDateForStorage(date))
          setOpen(false)
        }}
      />
    </div>
  )
}
