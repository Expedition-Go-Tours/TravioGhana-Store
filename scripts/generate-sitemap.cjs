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

const SITE_URL = (process.env.SITE_URL || 'https://www.travioghana.com').replace(/\/+$/, '');
const API_URL = (process.env.API_URL || process.env.VITE_API_URL || 'https://apiv1.travioafrica.com').replace(/\/+$/, '');
const OUTPUT = path.resolve(__dirname, '../public/sitemap.xml');

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
  { path: '/faq', priority: 0.5, changefreq: 'monthly' },
  { path: '/help-centre', priority: 0.4, changefreq: 'monthly' },
  { path: '/contact-us', priority: 0.4, changefreq: 'monthly' },
];

async function main() {
  console.log(`Generating sitemap from ${API_URL} -> ${OUTPUT}`);

  const urls = [];

  // Homepage
  urls.push(urlEntry(`${SITE_URL}/`, { priority: 1.0, changefreq: 'daily' }));

  // Static pages
  for (const p of STATIC_PAGES) {
    urls.push(urlEntry(`${SITE_URL}${p.path}`, { priority: p.priority, changefreq: p.changefreq }));
  }

  // Travel stories — the same travelStories.json the app renders and
  // scripts/generate-story-pages.cjs prerenders, so a story is only listed if
  // the crawler copy of it actually exists.
  try {
    const stories = JSON.parse(fs.readFileSync(path.resolve(__dirname, '../src/components/travelStories.json'), 'utf8'));
    for (const s of stories) {
      if (!s?.slug) continue;
      urls.push(urlEntry(`${SITE_URL}/stories/${encodeURIComponent(s.slug)}`, {
        priority: 0.6,
        changefreq: 'monthly',
      }));
    }
  } catch (err) {
    console.error(`WARN: could not read travelStories.json: ${err.message}`);
  }

  // Tours from the dedicated sitemap endpoint (slug + updatedAt)
  let tourCount = 0;
  const places = new Set();
  try {
    const data = await fetchJson(`${API_URL}/api/travioghana/tours/sitemap`);
    const tours = data?.data?.urls || [];

    for (const t of tours) {
      if (!t?.slug) continue;
      // Canonical form /tour/{id}/{slug}: the id keeps a link alive across
      // title changes; the slug is decorative. Slug-only fallback for older
      // sitemap payloads that predate the id field.
      const tourUrl = t.id
        ? `${SITE_URL}/tour/${encodeURIComponent(t.id)}/${encodeURIComponent(t.slug)}`
        : `${SITE_URL}/tour/${encodeURIComponent(t.slug)}`;
      urls.push(urlEntry(tourUrl, {
        priority: 0.8,
        changefreq: 'weekly',
        lastmod: isoDate(t.updatedAt),
      }));
      tourCount++;
    }

    // Destination pages — real, prerender-backed listings
    const listData = await fetchJson(`${API_URL}/api/travioghana/tours?limit=50`);
    for (const listing of listData?.data?.tours || []) {
      const tour = listing.tour || listing;
      if (tour.city) places.add(tour.city);
      if (tour.region) places.add(tour.region);
    }
    for (const place of places) {
      urls.push(urlEntry(`${SITE_URL}/tours?place=${encodeURIComponent(place)}`, {
        priority: 0.7,
        changefreq: 'weekly',
      }));
    }
  } catch (err) {
    console.error(`ERROR: could not fetch tours: ${err.message}`);
    if (fs.existsSync(OUTPUT)) {
      console.error('Refusing to overwrite the existing sitemap — keeping the last good version.');
      process.exit(0);
    }
    console.error('No existing sitemap to fall back to — writing static-only sitemap.');
  }

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
        xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
        xsi:schemaLocation="http://www.sitemaps.org/schemas/sitemap/0.9
        http://www.sitemaps.org/schemas/sitemap/0.9/sitemap.xsd">
${urls.join('\n')}
</urlset>`;

  fs.mkdirSync(path.dirname(OUTPUT), { recursive: true });
  fs.writeFileSync(OUTPUT, xml, 'utf8');
  console.log(`Sitemap written: ${urls.length} URLs (${tourCount} tours, ${places.size} destinations, ${STATIC_PAGES.length} static) — ${(Buffer.byteLength(xml) / 1024).toFixed(1)} KB`);

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

main().catch((err) => {
  console.error('FATAL:', err.message);
  process.exit(1);
});
