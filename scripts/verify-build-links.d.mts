// Types for scripts/verify-build-links.mjs, so tests can import it without a
// @ts-expect-error that would break if the import ever goes multi-line.
export type SegmentKind = 'offer' | 'tour' | 'unknown';

export interface ClassifyOptions {
  offerIds?: Set<string>;
  tourIds?: Set<string>;
}

export interface CheckRow {
  segment: string;
  ok: boolean;
  kind: SegmentKind;
}

export interface Summary {
  total: number;
  resolved: number;
  broken: number;
  byKind: Record<SegmentKind, number>;
  passed: boolean;
}

export declare function extractTourSegments(html: string): string[];
export declare function classifySegment(segment: string, options?: ClassifyOptions): SegmentKind;
export declare function summarise(rows: CheckRow[]): Summary;
export declare function isEntrypoint(argv1: string | undefined, moduleUrl: string): boolean;
