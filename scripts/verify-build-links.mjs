/**
 * Prod-readiness gate: every `/tour/` link in a built page must resolve.
 *
 * This exists because of a shipped bug. The homepage's last-minute rail built
 * each card with the *offer* row's id instead of the *tour* id, so ten of the
 * links the site published pointed at `/tour/{offerId}/{slug}`. The SPA sends
 * the first path segment to `GET /tours/{idOrSlug}`, an offer is not a tour,
 * and every one of those cards rendered "Tour not found" to a real visitor.
 *
 * Unit tests caught the id, but nothing checked the *artifact* — the thing that
 * actually ships. This does. It reads the built HTML, extracts every tour link,
 * and resolves it against the live API. Any 404 fails the run with exit 1.
 *
 * Deliberately NOT part of `npm run build`: it needs the network, and a build
 * that fails because the API is briefly unreachable is worse than no gate. Run
 * it explicitly (`npm run verify:links`) before deploying.
 *
 * Usage:  node scripts/verify-build-links.mjs [file ...]
 *         (defaults to the prerendered homepage and the SPA shell)
 */

import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

/** Link prefixes, in the order the SPA itself tries them. */
const API_PREFIXES = ['', '/travioghana', '/expedition'];

const OFFERS_URL = 'https://apiv1.travioafrica.com/api/homepage/offers';

const DEFAULT_FILES = ['dist/__seo/index.html', 'dist/index.html'];

/**
 * Pull the first path segment out of every `/tour/...` href in a document.
 *
 * Matches both the canonical two-segment form and the legacy single-segment
 * one, and matches on the href attribute alone so it is unaffected by where the
 * link sits in the tree.
 */
export function extractTourSegments(html) {
  const out = new Set();
  // `[^"/]+` needs at least one character, so a bare `/tour/` or `/tour//slug`
  // never matches at all — there is no empty-segment case to guard against.
  for (const m of html.matchAll(/href="\/tour\/([^"/]+)(?:\/[^"]*)?"/g)) {
    out.add(m[1]);
  }
  return [...out];
}

/**
 * Label a segment so a failure says *why* it is a failure. An offer id is a
 * regression of the bug above; a tour id that 404s is a different, worse
 * problem (a de-listed tour still linked); anything else is unexplained.
 */
export function classifySegment(segment, { offerIds = new Set(), tourIds = new Set() } = {}) {
  if (offerIds.has(segment)) return 'offer';
  if (tourIds.has(segment)) return 'tour';
  return 'unknown';
}

const REASONS = {
  offer: 'OFFER id used as a tour id (the last-minute-rail bug)',
  tour: 'a live tour id that 404s — still linked, but gone from the catalogue',
  unknown: 'unknown id — not in the offers payload at all',
};

/** Tally `{ segment, ok, kind }` rows into the numbers the report prints. */
export function summarise(rows) {
  const broken = rows.filter((r) => !r.ok);
  const byKind = { offer: 0, tour: 0, unknown: 0 };
  for (const r of broken) byKind[r.kind] = (byKind[r.kind] || 0) + 1;
  return {
    total: rows.length,
    resolved: rows.length - broken.length,
    broken: broken.length,
    byKind,
    passed: broken.length === 0 && rows.length > 0,
  };
}

async function resolves(segment) {
  for (const p of API_PREFIXES) {
    try {
      const res = await fetch(`https://apiv1.travioafrica.com/api${p}/tours/${segment}`, {
        signal: AbortSignal.timeout(20000),
      });
      if (res.ok) return true;
    } catch {
      /* try the next prefix */
    }
  }
  return false;
}

async function readOfferIds() {
  const res = await fetch(OFFERS_URL, { signal: AbortSignal.timeout(30000) });
  const json = await res.json();
  const list = json?.data?.tours || json?.data?.offers || [];
  return {
    offerIds: new Set(list.map((o) => o.offerId).filter(Boolean)),
    tourIds: new Set(list.map((o) => o.id).filter(Boolean)),
  };
}

async function main() {
  const { readFileSync } = await import('node:fs');
  const files = process.argv.slice(2);
  const targets = files.length ? files : DEFAULT_FILES;

  const { offerIds, tourIds } = await readOfferIds();

  let anyBroken = 0;
  let checkedAny = false;

  for (const file of targets) {
    let html;
    try {
      html = readFileSync(file, 'utf8');
    } catch {
      console.log(`\n${file}\n  (not present — skipped)`);
      continue;
    }

    const segs = extractTourSegments(html);
    console.log(`\n${file}\n  ${(html.length / 1024).toFixed(1)} KB, ${segs.length} distinct /tour/ links`);

    if (!segs.length) {
      console.log('  no tour links to check');
      continue;
    }
    checkedAny = true;

    const rows = await Promise.all(
      segs.map(async (segment) => ({
        segment,
        ok: await resolves(segment),
        kind: classifySegment(segment, { offerIds, tourIds }),
      })),
    );

    const s = summarise(rows);
    console.log(`  resolve: ${s.resolved}/${s.total}   broken: ${s.broken}`);
    for (const r of rows.filter((x) => !x.ok)) {
      console.log(`    404  ${r.segment}  <- ${REASONS[r.kind]}`);
    }
    anyBroken += s.broken;
  }

  if (!checkedAny) {
    console.log('\nRESULT: INCONCLUSIVE — no built page contained a tour link to check.');
    process.exit(1);
  }

  if (anyBroken) {
    console.log('\nRESULT: FAIL — the build ships broken tour links.');
    process.exit(1);
  }
  console.log('\nRESULT: PASS — every tour link in the build resolves.');
}

/**
 * True when this module is the process entrypoint.
 *
 * Exported so it can be tested directly. A naive `file://${argv[1]}` compare
 * does not survive a checkout path with a space in it, and when it fails the
 * whole script exits 0 having checked nothing — a gate that always passes is
 * worse than no gate, because it reads as a clean result.
 */
export function isEntrypoint(argv1, moduleUrl) {
  if (!argv1) return false;
  try {
    return resolve(argv1) === fileURLToPath(moduleUrl);
  } catch {
    return false;
  }
}

// Same resolution the existing prerender script uses.
if (isEntrypoint(process.argv[1], import.meta.url)) {
  main().catch((err) => {
    console.error('verify-build-links failed to run:', err?.message || err);
    process.exit(1);
  });
}
