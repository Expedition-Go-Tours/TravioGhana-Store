import { useState, useCallback } from "react"
import { MapPin, X, CheckCircle2 } from "lucide-react"

import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { GHANA_TOURIST_SITES_BY_REGION } from "@/lib/ghanaTouristSites"

function FieldLabel({ children, required }: { children: React.ReactNode; required?: boolean }) {
  return (
    <label className="mb-1.5 block text-sm font-semibold text-slate-700">
      {children}
      {required && <span className="ml-1 text-rose-500">*</span>}
    </label>
  )
}

interface GhanaDestinationSelectProps {
  selected?: string[]
  onChange: (value: string[]) => void
  required?: boolean
}

export default function GhanaDestinationSelect({
  selected = [],
  onChange,
  required,
}: GhanaDestinationSelectProps) {
  const [selectKey, setSelectKey] = useState(0)

  const addSite = useCallback(
    (site: string) => {
      if (!site || selected.includes(site)) return
      onChange([...selected, site])
      setSelectKey((k) => k + 1)
    },
    [selected, onChange]
  )

  const removeSite = useCallback(
    (site: string) => {
      onChange(selected.filter((s) => s !== site))
    },
    [selected, onChange]
  )

  return (
    <div>
      <FieldLabel required={required}>Destinations You Operate In</FieldLabel>
      <p className="mb-2 text-xs text-slate-500">
        Select tourist sites across Ghana. Each choice is added to your list — you can pick as many
        as you operate in.
      </p>

      {selected.length > 0 && (
        <div className="mb-3 flex flex-wrap gap-2">
          {selected.map((site) => (
            <span
              key={site}
              className="inline-flex max-w-full items-center gap-1 rounded-full bg-primary/10 px-3 py-1.5 text-xs font-semibold text-primary"
            >
              <CheckCircle2 className="size-3 shrink-0" />
              <span className="truncate">{site}</span>
              <button
                type="button"
                onClick={() => removeSite(site)}
                className="ml-0.5 shrink-0 rounded-full p-0.5 hover:bg-primary/10"
                aria-label={`Remove ${site}`}
              >
                <X className="size-3" />
              </button>
            </span>
          ))}
        </div>
      )}

      <Select key={selectKey} onValueChange={addSite}>
        <SelectTrigger className="h-12 w-full rounded-[1.4rem] border border-input bg-white text-foreground shadow-sm">
          <div className="flex items-center gap-2 text-left">
            <MapPin className="size-4 shrink-0 text-muted-foreground" />
            <SelectValue placeholder="Select a tourist site to add..." />
          </div>
        </SelectTrigger>
        <SelectContent side="bottom" sideOffset={4} className="max-h-[min(360px,70vh)]">
          {GHANA_TOURIST_SITES_BY_REGION.map(({ region, sites }) => (
            <SelectGroup key={region}>
              <SelectLabel>{region}</SelectLabel>
              {sites.map((site) => (
                <SelectItem
                  key={`${region}-${site}`}
                  value={site}
                  disabled={selected.includes(site)}
                  className={selected.includes(site) ? "opacity-50" : ""}
                >
                  {site}
                  {selected.includes(site) ? " (added)" : ""}
                </SelectItem>
              ))}
            </SelectGroup>
          ))}
        </SelectContent>
      </Select>
    </div>
  )
}
