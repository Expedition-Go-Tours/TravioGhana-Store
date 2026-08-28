import { Component, type ErrorInfo, type ReactNode } from 'react'

interface MapErrorBoundaryProps {
  children: ReactNode
  /** Change this to reset the boundary (e.g. when a new tour mounts). */
  resetKey?: unknown
  fallback?: ReactNode
}

interface MapErrorBoundaryState {
  hasError: boolean
}

/**
 * Contains a map-renderer crash (e.g. the Google Maps library throwing when
 * its API is quota/auth-limited) so the booking page or the pickup modal
 * never blanks out — the rest of the form keeps working and the map area
 * shows a simple fallback instead.
 */
export default class MapErrorBoundary extends Component<MapErrorBoundaryProps, MapErrorBoundaryState> {
  state: MapErrorBoundaryState = { hasError: false }

  static getDerivedStateFromError(): MapErrorBoundaryState {
    return { hasError: true }
  }

  componentDidUpdate(prevProps: MapErrorBoundaryProps): void {
    if (this.state.hasError && this.props.resetKey !== prevProps.resetKey) {
      this.setState({ hasError: false })
    }
  }

  componentDidCatch(error: unknown, info: ErrorInfo): void {
    console.error('[MapErrorBoundary] map renderer crashed:', error, info)
  }

  render(): ReactNode {
    if (this.state.hasError) {
      return (
        this.props.fallback ?? (
          <div className="p-3">
            <div className="flex h-[320px] items-center justify-center rounded-xl border border-slate-200/40 bg-slate-50 px-4 text-center sm:h-[340px]">
              <p className="text-xs leading-relaxed text-slate-500">
                The map is temporarily unavailable — your pickup location can still be confirmed after booking.
              </p>
            </div>
          </div>
        )
      )
    }
    return this.props.children
  }
}
