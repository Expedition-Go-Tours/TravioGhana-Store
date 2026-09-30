/**
 * Press mentions — the sites that have written about Travio Ghana.
 *
 * Add an entry the day coverage goes live; `FeaturedIn` renders nothing at all
 * while this list is empty, so the /press page needs no other change to start
 * showing a coverage band. Keep the entries to real, editorial coverage:
 *
 *   { outlet: 'Example News', title: 'The headline as published', url: 'https://…', date: '2026-10-01' }
 *
 * One rule: every entry must carry a URL that resolves. A dead link in a
 * "featured in" band reads as a fabrication, which is worse than an empty band.
 */
export interface PressMention {
  /** Publication name, e.g. "MyJoyOnline". */
  outlet: string
  /** Headline of the piece. */
  title: string
  /** Canonical URL of the coverage. Must resolve. */
  url: string
  /** Publication date, ISO `YYYY-MM-DD`. */
  date: string
}

export const PRESS_MENTIONS: PressMention[] = []
