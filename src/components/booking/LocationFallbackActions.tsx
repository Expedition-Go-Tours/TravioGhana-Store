import { ChevronRight, Link2, Search } from 'lucide-react'

interface LocationFallbackActionsProps {
  /** The text the traveller typed into the location search. */
  query: string
  /** Whether the server-backed Google Maps search should be offered. */
  showSearch: boolean
  /** Run the Google Maps fallback search. */
  onSearch: () => void
  /** Open the paste-a-Google-Maps-link panel. */
  onPaste: () => void
}

/**
 * The "can't find it" actions at the bottom of a booking location dropdown.
 *
 * These deliberately do not use the suggestion-row styling: they are a
 * separate, always-visible footer with brand-coloured icon tiles, so Search
 * Google Maps and Paste a Google Maps link cannot be mistaken for another
 * address suggestion.
 */
export default function LocationFallbackActions({
  query,
  showSearch,
  onSearch,
  onPaste,
}: LocationFallbackActionsProps) {
  return (
    <div className="border-t border-slate-200/70 bg-slate-50/80 p-2.5">
      <p className="px-1 pb-2 text-[10px] font-bold uppercase tracking-[0.12em] text-slate-400">
        Can’t find your location?
      </p>

      <div className="space-y-1.5">
        {showSearch && (
          <button
            type="button"
            onMouseDown={(e) => e.preventDefault()}
            onClick={onSearch}
            className="group flex w-full items-center gap-3 rounded-xl border border-blue-100 bg-white p-3 text-left shadow-sm transition-colors hover:border-blue-200 hover:bg-blue-50/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-200"
          >
            <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-blue-50 text-blue-600">
              <Search size={17} strokeWidth={2.2} />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-semibold text-slate-900">Search Google Maps</span>
              <span className="mt-0.5 block truncate text-xs text-slate-500">
                Look up “{query.trim()}” in Ghana
              </span>
            </span>
            <ChevronRight size={16} className="shrink-0 text-blue-500 transition-transform group-hover:translate-x-0.5" />
          </button>
        )}

        <button
          type="button"
          onMouseDown={(e) => e.preventDefault()}
          onClick={onPaste}
          className="group flex w-full items-center gap-3 rounded-xl border border-emerald-100 bg-white p-3 text-left shadow-sm transition-colors hover:border-emerald-200 hover:bg-emerald-50/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-200"
        >
          <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-emerald-50 text-emerald-700">
            <Link2 size={17} strokeWidth={2.2} />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-sm font-semibold text-slate-900">Paste a Google Maps link</span>
            <span className="mt-0.5 block text-xs leading-snug text-slate-500">
              Pin the exact spot from a link you copied
            </span>
          </span>
          <ChevronRight size={16} className="shrink-0 text-emerald-600 transition-transform group-hover:translate-x-0.5" />
        </button>
      </div>
    </div>
  )
}
