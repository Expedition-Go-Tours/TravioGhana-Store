#!/usr/bin/env node
/**
 * Generate sitemap.xml for TravioGhana.
 *
 * Pulls the live catalogue from the API's dedicated sitemap endpoints so every
 * tour carries a real <lastmod>, then merges the static marketing pages.
 *
 * Guarded: if the API can't be reached it refuses to overwrite an existing
 * sitemap (an empty/stale sitemap is worse than no update), so a network blip
 * during a build can never wipe the storefront's URL set.
 *
 * Usage:
 *   API_URL=https://apiv1.travioafrica.com node scripts/generate-sitemap.cjs
 */

const fs = require('fs');
const path = require('path');
const https = require('https');
const http = require('http');

const { execFileSync } = require('child_process');

const SITE_URL = (process.env.SITE_URL || 'https://www.travioghana.com').replace(/\/+$/, '');
const API_ROOT = (process.env.API_URL || process.env.VITE_API_URL || 'https://apiv1.travioafrica.com').replace(/\/+$/, '');
const BRAND = 'travioghana';
const REPO_ROOT = path.resolve(__dirname, '..');

/**
 * The brand-scoped catalogue base, e.g. https://apiv1.travioafrica.com/api/travioghana
 *
 * API_URL is not one shape. In production Vercel sets it to the brand-scoped
 * value the app itself uses (`VITE_API_URL` =
 * https://apiv1.travioafrica.com/api/travioghana), while the local default is a
 * bare origin. Appending the brand path unconditionally to the former produced
 * /api/travioghana/api/travioghana/tours/sitemap, which 404s — and because a
 * failed fetch deliberately falls back to the last good sitemap rather than
 * overwriting it, that failure was invisible: the build printed one ERROR line
 * and shipped a sitemap frozen to whenever it was last written by hand. New
 * tours were never discovered by Google.
 *
 * Normalise all three shapes (bare origin, /api, /api/<brand>) to the one the
 * endpoints actually live at.
 */
function brandApiBase() {
  if (new RegExp(`/api/${BRAND}$`, 'i').test(API_ROOT)) return API_ROOT;
  if (/\/api$/i.test(API_ROOT)) return `${API_ROOT}/${BRAND}`;
  return `${API_ROOT}/api/${BRAND}`;
}

const API_URL = brandApiBase();
const OUTPUT = path.resolve(__dirname, '../public/sitemap.xml');

/** Catalogue paging, for the destination list. See the loop in main(). */
const CATALOGUE_PAGE_SIZE = 50; // the API rejects limit above 50
const MAX_CATALOGUE_PAGES = 20;

function fetchJson(url) {
  return new Promise((resolve, reject) => {
    const mod = url.startsWith('https') ? https : http;
    mod.get(url, { timeout: 20000 }, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        return fetchJson(res.headers.location).then(resolve, reject);
      }
      let data = '';
      res.on('data', (c) => (data += c));
      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          try { resolve(JSON.parse(data)); } catch (e) { reject(e); }
        } else {
          reject(new Error(`HTTP ${res.statusCode}: ${data.slice(0, 200)}`));
        }
      });
    }).on('error', reject);
  });
}

function xmlEscape(s) {
  return String(s || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function urlEntry(loc, { priority = 0.5, changefreq = 'weekly', lastmod } = {}) {
  const mod = lastmod ? `\n  <lastmod>${lastmod}</lastmod>` : '';
  return `<url>
  <loc>${xmlEscape(loc)}</loc>${mod}
  <changefreq>${changefreq}</changefreq>
  <priority>${priority}</priority>
</url>`;
}

function isoDate(value) {
  if (!value) return undefined;
  const d = new Date(value);
  if (isNaN(d.getTime())) return undefined;
  return d.toISOString().split('T')[0];
}

/** Newest of a set of YYYY-MM-DD strings; undefined if none survived. */
function latestDate(...sets) {
  const all = sets.flat().filter(Boolean).sort();
  return all[all.length - 1] || undefined;
}

/**
 * The date a marketing page last actually changed, read from git.
 *
 * These pages are app-rendered routes: their content changed when their source
 * changed, and git already recorded exactly when. Handing every static page
 * the newest catalogue date instead meant /privacy-policy claimed to change
 * every time a price did — 21 pages all reporting one number, which is how a
 * crawler learns that this sitemap's lastmod is noise and starts discounting
 * the site-wide signal the comment above warns about.
 *
 * Returns undefined rather than guessing when git cannot answer. Vercel does
 * not always ship a .git to the build container, and a shallow checkout has no
 * history to find; in both cases the caller falls back to the catalogue date,
 * which is the old behaviour rather than a fabricated one.
 */
function gitLastModified(files) {
  const existing = files.filter((f) => fs.existsSync(path.join(REPO_ROOT, f)));
  if (existing.length === 0) return undefined;
  try {
    const out = execFileSync('git', ['log', '-1', '--format=%as', '--', ...existing], {
      cwd: REPO_ROOT,
      stdio: ['ignore', 'pipe', 'ignore'],
      encoding: 'utf8',
      timeout: 15000,
    }).trim();
    return /^\d{4}-\d{2}-\d{2}$/.test(out) ? out : undefined;
  } catch {
    return undefined;
  }
}

/** Tracked source files, memoised — one `git ls-files` for all 21 routes. */
let trackedCache = null;
function trackedSrcFiles() {
  if (trackedCache) return trackedCache;
  try {
    trackedCache = execFileSync('git', ['ls-files', 'src'], {
      cwd: REPO_ROOT,
      stdio: ['ignore', 'pipe', 'ignore'],
      encoding: 'utf8',
      timeout: 15000,
    }).split('\n').filter(Boolean);
  } catch {
    trackedCache = [];
  }
  return trackedCache;
}

/**
 * Shared files that change the rendered page of *every* route: App.tsx owns
 * the layout the header and footer render into, and Footer is precisely what
 * the 2026-09-28 fix added to /tours and /reviews. Leave these out and a
 * change to the shared chrome never moves a marketing page's lastmod — the
 * reverse failure of the over-claim above, and the more damaging one, since it
 * hides a real change.
 */
const SHARED_PAGE_SOURCES = ['src/App.tsx', 'src/components/Footer.tsx', 'src/components/Footer.css'];

/**
 * Pages that render the catalogue (or its derived review stats), so they also
 * change when it does. These take the later of their git date and the newest
 * content date; everything else answers only for itself.
 */
const CATALOGUE_BACKED_PAGES = new Set(['/', '/tours', '/reviews']);

/**
 * path -> the source files whose change changes that page.
 *
 * Resolved from App.tsx's own route table rather than a hand-written map: a
 * map rots the moment a route is renamed, and a date that silently stops
 * tracking is the same quiet failure as the frozen-sitemap bug noted above.
 * Resolves nothing when App.tsx cannot be read, so the caller falls back.
 */
function staticPageSources() {
  let app;
  try {
    app = fs.readFileSync(path.join(REPO_ROOT, 'src/App.tsx'), 'utf8');
  } catch (err) {
    console.warn(`WARN: cannot read App.tsx to resolve routes (${err.message}) — static pages fall back to the newest content date`);
    return new Map();
  }

  // component basename -> every tracked file sharing it, so `AllToursPage`
  // picks up its .css as well as its .tsx.
  const byBase = new Map();
  for (const f of trackedSrcFiles()) {
    const base = path.basename(f).replace(/\.[a-z]+$/i, '');
    if (!byBase.has(base)) byBase.set(base, []);
    byBase.get(base).push(f);
  }

  // Brace-count the element expression so a nested `fallback={<X />}` cannot
  // end it early, then take the innermost component: for
  // `<Suspense fallback={<Skel/>}><HelpCentrePage/></Suspense>` that skips both
  // the Suspense wrapper and the fallback skeleton.
  const componentFor = (expr) => {
    const names = [...expr.matchAll(/<([A-Z][A-Za-z0-9_]*)/g)].map((m) => m[1]);
    if (names.length === 0) return undefined;
    const candidate = names[names.length - 1];
    return candidate === 'Navigate' ? undefined : candidate;
  };

  const map = new Map();
  // '/' too: the homepage is not in STATIC_PAGES, and relying on the caller's
  // shared-source default to date it is exactly the kind of accidental
  // correctness that hides a route from the resolution pass.
  for (const route of ['/', ...STATIC_PAGES.map((p) => p.path)]) {
    const start = app.indexOf(`<Route path="${route}"`);
    if (start < 0) {
      console.warn(`WARN: ${route} has no route in App.tsx — falling back to the newest content date`);
      continue;
    }
    const open = app.indexOf('{', app.indexOf('element=', start));
    if (open < 0) continue;
    let depth = 0;
    let end = open;
    for (; end < app.length; end++) {
      if (app[end] === '{') depth++;
      else if (app[end] === '}') {
        depth--;
        if (depth === 0) break;
      }
    }
    const component = componentFor(app.slice(open + 1, end));
    const own = (component && byBase.get(component)) || [];
    map.set(route, [...new Set([...own, ...SHARED_PAGE_SOURCES])]);
  }
  return map;
}

/**
 * lastmod for an app-rendered route: its own git date, upgraded to the
 * catalogue date where the page actually renders the catalogue.
 *
 * Falls back to the catalogue date when git cannot answer, which is what every
 * static page did before — a deliberate downgrade of the fix to a safe default
 * rather than an invented date.
 */
function marketingLastmod(route, sources, catalogueDate) {
  const gitDate = gitLastModified(sources.get(route) || SHARED_PAGE_SOURCES);
  return CATALOGUE_BACKED_PAGES.has(route)
    ? latestDate(gitDate, catalogueDate) || catalogueDate
    : gitDate || catalogueDate;
}

// Static pages — kept in sync with the prerender templates in
// Backendv2/controllers/prerenderController.js (handleStaticPage). A URL listed
// here without a matching template renders as a homepage duplicate, which is
// exactly the soft-duplicate problem this sitemap must avoid.
const STATIC_PAGES = [
  { path: '/tours', priority: 0.9, changefreq: 'daily' },
  { path: '/about-us', priority: 0.6, changefreq: 'monthly' },
  { path: '/stories', priority: 0.6, changefreq: 'weekly' },
  { path: '/blog', priority: 0.6, changefreq: 'weekly' },
  { path: '/reviews', priority: 0.6, changefreq: 'weekly' },
  { path: '/foundation', priority: 0.4, changefreq: 'monthly' },
  { path: '/careers', priority: 0.4, changefreq: 'monthly' },
  { path: '/partnerships', priority: 0.4, changefreq: 'monthly' },
  // Press & partner resources: low priority as pages, high value as link
  // targets — the two pages journalists and partners are asked to cite.
  { path: '/press', priority: 0.4, changefreq: 'monthly' },
  { path: '/partner-resources', priority: 0.4, changefreq: 'monthly' },
  { path: '/faq', priority: 0.5, changefreq: 'monthly' },
  { path: '/help-centre', priority: 0.4, changefreq: 'monthly' },
  { path: '/contact-us', priority: 0.4, changefreq: 'monthly' },
  // Service and trade landing pages — all prerendered, but they were only
  // reachable by internal links, so nothing told Google to crawl them.
  { path: '/transport', priority: 0.7, changefreq: 'weekly' },
  { path: '/content-creators', priority: 0.6, changefreq: 'monthly' },
  { path: '/hotels', priority: 0.5, changefreq: 'monthly' },
  { path: '/transport-providers', priority: 0.5, changefreq: 'monthly' },
  { path: '/travel-agents', priority: 0.5, changefreq: 'monthly' },
  // Legal pages: low priority, but they are indexable and people do search
  // for them by name.
  { path: '/refund-policy', priority: 0.3, changefreq: 'yearly' },
  { path: '/privacy-policy', priority: 0.3, changefreq: 'yearly' },
  { path: '/cookies-policy', priority: 0.3, changefreq: 'yearly' },
  { path: '/terms-and-conditions', priority: 0.3, changefreq: 'yearly' },
  { path: '/supplier-terms', priority: 0.3, changefreq: 'yearly' },
];

async function main() {
  console.log(`Generating sitemap from ${API_URL} -> ${OUTPUT}`);

  // ── 1. Collect real content first ─────────────────────────────────────
  // Every entry gets a <lastmod> from actual data (never a build timestamp):
  // Google uses lastmod to decide what to re-crawl, and an inaccurate date is
  // ignored — or worse, discounted for the whole sitemap.
  //
  // "Actual data" is read per source: tours and stories carry their API /
  // publish date, and the marketing pages carry the git history of the files
  // that render them (gitLastModified).

  // Travel stories — the same travelStories.json the app renders and
  // scripts/generate-story-pages.cjs prerenders, so a story is only listed if
  // the crawler copy of it actually exists.
  const stories = [];
  try {
    const raw = JSON.parse(fs.readFileSync(path.resolve(__dirname, '../src/components/travelStories.json'), 'utf8'));
    for (const s of raw) {
      if (!s?.slug) continue;
      stories.push({ slug: s.slug, lastmod: isoDate(s.dateISO || s.date) });
    }
  } catch (err) {
    console.error(`WARN: could not read travelStories.json: ${err.message}`);
  }

  // Tours + destinations from the API (canonical /tour/{id}/{slug} URLs).
  let tourEntries = [];
  let places = [];
  try {
    const data = await fetchJson(`${API_URL}/tours/sitemap`);
    tourEntries = (data?.data?.urls || [])
      .filter((t) => t?.slug)
      .map((t) => ({
        // The id keeps a link alive across title changes; the slug is
        // decorative. Slug-only fallback for older payloads without an id.
        url: t.id
          ? `${SITE_URL}/tour/${encodeURIComponent(t.id)}/${encodeURIComponent(t.slug)}`
          : `${SITE_URL}/tour/${encodeURIComponent(t.slug)}`,
        lastmod: isoDate(t.updatedAt),
      }));

    // Destination pages — real, prerender-backed listings.
    //
    // This used to read a single `?limit=50` page. The catalogue is 32 tours
    // today so nothing was lost, but that is luck, not design: there is no
    // `total` in the response to notice the overflow by, and the moment the
    // catalogue passes 50 the sitemap would quietly stop listing the
    // destinations that only exist on tours 51+. New pages would then be
    // undiscoverable except by crawling, which is the same class of silent
    // truncation as the frozen-sitemap bug above.
    //
    // So page through it. The API paginates by 1-indexed `page` (`offset` and
    // `skip` are accepted and ignored), and the loop stops on the first short
    // page, which is the last page.
    const placeSet = new Set();
    let truncated = false;
    for (let page = 1; page <= MAX_CATALOGUE_PAGES; page++) {
      const listData = await fetchJson(`${API_URL}/tours?limit=${CATALOGUE_PAGE_SIZE}&page=${page}`);
      const rows = listData?.data?.tours || [];
      for (const listing of rows) {
        const tour = listing.tour || listing;
        if (tour.city) placeSet.add(tour.city);
        if (tour.region) placeSet.add(tour.region);
      }
      if (rows.length < CATALOGUE_PAGE_SIZE) break;
      if (page === MAX_CATALOGUE_PAGES) truncated = true;
    }
    if (truncated) {
      console.warn(
        `WARN: catalogue still full after ${MAX_CATALOGUE_PAGES} pages of ${CATALOGUE_PAGE_SIZE} ` +
          `tours — the destination list below is incomplete. Raise MAX_CATALOGUE_PAGES.`
      );
    }
    places = [...placeSet];
  } catch (err) {
    console.error(`ERROR: could not fetch tours: ${err.message}`);
    if (fs.existsSync(OUTPUT)) {
      console.error('Refusing to overwrite the existing sitemap — keeping the last good version.');
      process.exit(0);
    }
    console.error('No existing sitemap to fall back to — writing static-only sitemap.');
  }

  // ── 2. Dates ─────────────────────────────────────────────────────────
  const contentDates = [...stories.map((s) => s.lastmod), ...tourEntries.map((t) => t.lastmod)]
    .filter(Boolean)
    .sort();
  // Pages whose body is the catalogue itself (home, /tours, /reviews) change
  // whenever the catalogue does, so they take the newest content date as a
  // floor. Every other static page answers for its own source — see
  // marketingLastmod() — rather than inheriting this number by default.
  const newestContentDate = contentDates[contentDates.length - 1] || new Date().toISOString().split('T')[0];
  const newestTourDate = tourEntries.map((t) => t.lastmod).filter(Boolean).sort().pop() || newestContentDate;

  // ── 3. Entries ───────────────────────────────────────────────────────
  const urls = [];

  // Marketing pages: the date their source last changed, taken from git.
  // HomePage is defined inline in App.tsx, so App.tsx *is* its source.
  const sources = staticPageSources();

  // Homepage
  urls.push(urlEntry(`${SITE_URL}/`, {
    priority: 1.0,
    changefreq: 'daily',
    lastmod: marketingLastmod('/', sources, newestContentDate),
  }));

  // Static pages
  for (const p of STATIC_PAGES) {
    urls.push(
      urlEntry(`${SITE_URL}${p.path}`, {
        priority: p.priority,
        changefreq: p.changefreq,
        lastmod: marketingLastmod(p.path, sources, newestContentDate),
      })
    );
  }

  for (const s of stories) {
    urls.push(urlEntry(`${SITE_URL}/stories/${encodeURIComponent(s.slug)}`, {
      priority: 0.6,
      changefreq: 'monthly',
      lastmod: s.lastmod,
    }));
  }

  for (const t of tourEntries) {
    urls.push(urlEntry(t.url, { priority: 0.8, changefreq: 'weekly', lastmod: t.lastmod }));
  }

  // Destination listings mirror the (self-canonical) /tours?place= pages, so
  // they carry the newest tour date.
  for (const place of places) {
    urls.push(urlEntry(`${SITE_URL}/tours?place=${encodeURIComponent(place)}`, {
      priority: 0.7,
      changefreq: 'weekly',
      lastmod: newestTourDate,
    }));
  }

  const entriesWithLastmod = urls.filter((u) => u.includes('<lastmod>')).length;

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
        xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
        xsi:schemaLocation="http://www.sitemaps.org/schemas/sitemap/0.9
        http://www.sitemaps.org/schemas/sitemap/0.9/sitemap.xsd">
${urls.join('\n')}
</urlset>`;

  fs.mkdirSync(path.dirname(OUTPUT), { recursive: true });
  fs.writeFileSync(OUTPUT, xml, 'utf8');
  console.log(`Sitemap written: ${urls.length} URLs (${tourEntries.length} tours, ${places.length} destinations, ${STATIC_PAGES.length} static, ${stories.length} stories) — ${entriesWithLastmod}/${urls.length} with lastmod — ${(Buffer.byteLength(xml) / 1024).toFixed(1)} KB`);

  // robots.txt — generated so the Sitemap directive always uses the canonical
  // host (a hardcoded file drifts whenever the host changes).
  //
  // Disallow covers URL spaces that would otherwise be crawled forever
  // (booking flow, free-text search, per-title review forms). Everything that
  // is meant to be judged on its meta tags stays allowed — blocking a page
  // also blocks Google from reading its noindex, which is the opposite of what
  // a noindex page needs.
  const robots = `User-agent: *
Allow: /
Disallow: /dashboard/
Disallow: /booking/
Disallow: /search
Disallow: /review/
Disallow: /auth/
Disallow: /login
Disallow: /api/
Disallow: /payment-methods
Disallow: /supplier/register
Disallow: /supplier/list-experience

# Build-time prerender output. middleware.ts serves these files to crawlers at
# the real URL (/about-us etc.), so this prefix is never a page anyone should
# fetch or index directly — it would be a duplicate of a live URL.
Disallow: /__seo/

User-agent: Googlebot
Allow: /

User-agent: Bingbot
Allow: /

User-agent: Twitterbot
Allow: /

User-agent: facebookexternalhit
Allow: /

Sitemap: ${SITE_URL}/sitemap.xml
`;
  fs.writeFileSync(path.resolve(__dirname, '../public/robots.txt'), robots, 'utf8');
  console.log(`robots.txt written (Sitemap: ${SITE_URL}/sitemap.xml)`);
}

/**
 * Exported for src/test/generateSitemap.test.ts. `main()` only runs when this
 * file is the entrypoint — requiring it from a test would otherwise fire the
 * live API fetch and overwrite public/sitemap.xml as a side effect of running
 * the unit suite.
 */
module.exports = {
  STATIC_PAGES,
  SHARED_PAGE_SOURCES,
  CATALOGUE_BACKED_PAGES,
  isoDate,
  latestDate,
  gitLastModified,
  staticPageSources,
  marketingLastmod,
};

if (require.main === module) {
  main().catch((err) => {
    console.error('FATAL:', err.message);
    process.exit(1);
  });
}
