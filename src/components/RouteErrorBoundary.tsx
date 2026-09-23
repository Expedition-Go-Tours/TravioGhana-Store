import { Component, type ReactNode } from 'react'

interface RouteErrorBoundaryProps {
  children: ReactNode
}

interface RouteErrorBoundaryState {
  hasError: boolean
  message?: string
}

/**
 * True when the failure is a stale-deploy module/chunk fetch (the currently
 * loaded index.html references a hashed chunk a redeploy already deleted).
 * Those are recoverable with a plain reload; render bugs are not.
 */
const CHUNK_LOAD_ERROR =
  /Failed to fetch dynamically imported module|Importing a module script failed|error loading dynamically imported module|Loading (?:CSS )?chunk \d+ failed|failed to fetch dynamically imported module/i

export function isChunkLoadError(error: unknown): boolean {
  if (!(error instanceof Error)) return false
  return CHUNK_LOAD_ERROR.test(error.message)
}

// Auto-recover once per page life: after the reload the fresh manifest is in
// place, so if a chunk error still surfaces it is a real bug (shown normally).
let chunkReloadAttempted = false

/**
 * App-level error boundary around the routed pages. Without this, any render
 * error during a client-side route change unmounts the whole tree and leaves a
 * blank white screen (React 18). With it, the user sees a "reload" screen and
 * the error is logged so this class of bug stops being invisible. Stale-deploy
 * chunk failures (a route chunk that no longer exists after a redeploy) are
 * recovered automatically with a single hard reload instead of a dead end.
 */
export default class RouteErrorBoundary extends Component<RouteErrorBoundaryProps, RouteErrorBoundaryState> {
  state: RouteErrorBoundaryState = { hasError: false }

  static getDerivedStateFromError(error: unknown): RouteErrorBoundaryState {
    return {
      hasError: true,
      message: error instanceof Error ? error.message : String(error),
    }
  }

  componentDidCatch(error: unknown, info: unknown): void {
    console.error('[RouteErrorBoundary] Page crashed during navigation:', error, info)

    // Stale chunk after a redeploy: a reload fetches the current index.html
    // manifest and the route works again. Guarded so it never loops.
    if (isChunkLoadError(error) && !chunkReloadAttempted) {
      chunkReloadAttempted = true
      window.location.reload()
    }
  }

  private handleReload = () => {
    window.location.reload()
  }

  render() {
    if (this.state.hasError) {
      return (
        <div
          style={{
            minHeight: '60vh',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 12,
            textAlign: 'center',
            padding: 24,
          }}
        >
          <h1 style={{ margin: 0, fontFamily: 'var(--font-heading)', fontSize: 22, color: '#1a1a2e' }}>
            Something went wrong
          </h1>
          <p style={{ margin: 0, maxWidth: 440, fontFamily: 'var(--font-body)', fontSize: 14, color: '#667085' }}>
            An unexpected error happened while loading this page. Please reload to continue.
          </p>
          <button
            type="button"
            onClick={this.handleReload}
            style={{
              padding: '10px 22px',
              borderRadius: 999,
              border: 'none',
              background: 'var(--bv-accent, #16a34a)',
              color: '#fff',
              fontWeight: 600,
              cursor: 'pointer',
              fontSize: 14,
            }}
          >
            Reload page
          </button>
        </div>
      )
    }
    return this.props.children
  }
}
