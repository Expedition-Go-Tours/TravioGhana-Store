import './SectionRailDivider.css'

/**
 * In-rail divider between a scoped section's local results and the nearby/global
 * tours that pad it out.
 *
 * Without it, "Top Rated in Ashanti Region" reads as if every card were
 * regional — which is exactly what a user sees today when the region has one
 * tour and the row is filled with Cape Coast and Accra experiences. The label
 * comes from the API's backfill (`More experiences near Ashanti`).
 */
export default function SectionRailDivider({ label }: { label?: string | null }) {
  if (!label) return null

  return (
    <div className="section-rail-divider" role="separator" aria-label={label}>
      <span>{label}</span>
    </div>
  )
}
