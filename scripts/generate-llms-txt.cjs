#!/usr/bin/env node
/**
 * Generate llms.txt for TravioGhana.
 *
 * `llms.txt` is the llmstxt.org convention: a curated, machine-readable index
 * of the site that an AI assistant can read in one request instead of scraping
 * 50 HTML pages. The roadmap item (docs/seo/roast-2026-11-14.md, #6) asked for
 * "live tour count, price range and money-page URLs from the same constants
 * the pages use" — so the catalogue is read from the API at build time, the
 * marketing links come from generate-sitemap.cjs's STATIC_PAGES, and the
 * file is regenerated on every deploy rather than hand-edited.
 *
 * Guarded the same way as the sitemap: a failed API fetch never overwrites a
 * good file with a stale or empty one. An absent llms.txt is harmless; one
 * that claims the catalogue has zero tours is not.
 *
 * Usage:
 *   API_URL=https://apiv1.travioafrica.com node scripts/generate-llms-txt.cjs
 */

const fs = require('fs');
const path = require('path');
const https = require('https');
const http = require('http');

const { STATIC_PAGES } = require('./generate-sitemap.cjs');

const SITE_URL = (process.env.SITE_URL || 'https://www.travioghana.com').replace(/\/+$/, '');
const API_ROOT = (process.env.API_URL || process.env.VITE_API_URL || 'https://apiv1.travioafrica.com').replace(/\/+$/, '');
const BRAND = 'travioghana';
const OUTPUT = path.resolve(__dirname, '../public/llms.txt');

/** Same pagination contract as the sitemap: 50 is the API's maximum. */
const PAGE_SIZE = 50;
const MAX_PAGES = 20;

/**
 * Cities that are really one destination. The catalogue stores some Accra
 * tours against the administrative district (La-Dade-Kotopon, Okaikwei North)
 * because that is what geocoding returned, and a `?place=` link to a district
 * name is a worse landing page than the city every traveller searches for.
 * Anything not listed here is used as-is.
 */
const CITY_ALIASES = {
  'La-Dade-Kotopon Municipal District': 'Accra',
  'Okaikwei North Municipal District': 'Accra',
  'Kintampo South District': 'Kintampo',
};

/**
 * Marketing links, in the order an assistant should see them.
 *
 * Every path here must also be in STATIC_PAGES — a unit test asserts the two
 * sets are identical, so adding a page to the sitemap without describing it
 * here (or linking a page that does not exist) fails the suite.
 */
const PAGE_LINKS = [
  // Money pages: the surfaces that take a booking.
  { path: '/tours', section: 'book', label: 'All Ghana tours', note: 'The full catalogue with live prices, dates and availability.' },
  { path: '/transport', section: 'book', label: 'Transport and airport transfers', note: 'Private drivers, airport pickups and intercity transfers across Ghana.' },
  { path: '/hotels', section: 'book', label: 'Hotels and stays', note: 'Partner hotels that pair with the tour catalogue.' },
  { path: '/travel-agents', section: 'book', label: 'Travel agent programme', note: 'Trade bookings and support for travel agents selling Ghana.' },
  { path: '/content-creators', section: 'book', label: 'Content creator programme', note: 'Collaborations for travel creators visiting Ghana.' },
  { path: '/partner-resources', section: 'book', label: 'Partner resources', note: 'Logos, badges and copy-paste link snippets for partners.' },

  // Trust and company pages.
  { path: '/about-us', section: 'company', label: 'About Travio Ghana', note: 'The Accra-based operator behind the catalogue.' },
  { path: '/reviews', section: 'company', label: 'Traveller reviews', note: 'Reviews left by travellers who booked through the site.' },
  { path: '/faq', section: 'company', label: 'FAQ', note: 'Common questions about booking, pickup and cancellations.' },
  { path: '/help-centre', section: 'company', label: 'Help centre', note: 'Answers to booking, payment and cancellation questions.' },
  { path: '/contact-us', section: 'company', label: 'Contact', note: 'Support email, phone and office address in Accra.' },
  { path: '/payments-and-security', section: 'company', label: 'Payments and security', note: 'How payments, refunds and cancellation terms work.' },
  { path: '/press', section: 'company', label: 'Press', note: 'Brand facts, logos and media contact.' },
  { path: '/partnerships', section: 'company', label: 'Partnerships', note: 'Hotel, transport, agent and creator partnerships.' },
  { path: '/foundation', section: 'company', label: 'Expedition-Go Foundation', note: 'Community and conservation work funded by the operator.' },
  { path: '/careers', section: 'company', label: 'Careers', note: 'Open roles in Accra.' },

  // Supplier and legal pages: real, but not part of a traveller's decision.
  { path: '/transport-providers', section: 'optional', label: 'Transport provider programme', note: 'For drivers and transfer companies who want to supply trips.' },
  { path: '/supplier-terms', section: 'optional', label: 'Supplier terms', note: 'Terms for suppliers listing on the platform.' },
  { path: '/refund-policy', section: 'optional', label: 'Refund policy', note: 'Refund and cancellation rules by tour.' },
  { path: '/privacy-policy', section: 'optional', label: 'Privacy policy', note: 'How personal data is collected and used.' },
  { path: '/cookies-policy', section: 'optional', label: 'Cookies policy', note: 'Cookie use and how to control it.' },
  { path: '/terms-and-conditions', section: 'optional', label: 'Terms and conditions', note: 'The booking contract.' },
];

/** Blog index — listed in STATIC_PAGES, but llms.txt wants it under Guides. */
const BLOG_INDEX = { path: '/blog', label: 'All Ghana travel guides' };

function brandApiBase() {
  if (new RegExp(`/api/${BRAND}$`, 'i').test(API_ROOT)) return API_ROOT;
  if (/\/api$/i.test(API_ROOT)) return `${API_ROOT}/${BRAND}`;
  return `${API_ROOT}/api/${BRAND}`;
}

const API_URL = brandApiBase();
const BLOG_URL = `${API_URL.replace(new RegExp(`/${BRAND}$`, 'i'), '')}/blog`;

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
          try {
            resolve(JSON.parse(data));
          } catch (e) {
            reject(e);
          }
        } else {
          reject(new Error(`HTTP ${res.statusCode}: ${data.slice(0, 200)}`));
        }
      });
    }).on('error', reject);
  });
}

function formatMoney(value, currency = 'USD') {
  if (typeof value !== 'number' || !isFinite(value)) return '';
  const rendered = value.toLocaleString('en-US', { maximumFractionDigits: 0 });
  return currency === 'USD' ? `$${rendered}` : `${rendered} ${currency}`;
}

/**
 * The lowest and highest "from" price across the catalogue, ignoring tours
 * without one. Returns null when no tour carries a price, so the caller can
 * drop the sentence rather than print "$0–$0".
 */
function priceRange(tours) {
  const priced = (tours || []).filter((t) => typeof t.startingPrice === 'number' && t.startingPrice > 0);
  if (priced.length === 0) return null;
  const prices = priced.map((t) => t.startingPrice);
  const currencies = [...new Set(priced.map((t) => t.currency || 'USD'))];
  return {
    min: Math.min(...prices),
    max: Math.max(...prices),
    currency: currencies.length === 1 ? currencies[0] : null,
    currencies,
  };
}

/**
 * One-line summary for a list item.
 *
 * Prefer the first complete sentence: the API truncates list descriptions at
 * 300 characters, but every tour's first sentence fits inside that window
 * (the longest is 270), so the text reads as a sentence rather than a snippet
 * cut mid-word. A very short first sentence ("Ghanaian food rewards
 * curiosity.") is joined to the second when both fit, which is the difference
 * between a label and a description. Falls back to a word-boundary trim for
 * text with no sentence break at all.
 */
function summarise(text, maxChars = 240) {
  const clean = String(text || '').replace(/\s+/g, ' ').trim();
  if (!clean) return '';

  const sentences = sentenceList(clean);
  if (sentences.length === 0) {
    return trimTo(clean.replace(/\s*\.{3}$/, ''), maxChars);
  }

  let out = sentences[0];
  if (out.length < 90 && sentences[1]) {
    const joined = `${out} ${sentences[1]}`;
    if (joined.length <= maxChars) out = joined;
  }
  return trimTo(out, maxChars);
}

/** Complete sentences, in order; a truncated trailing fragment is ignored. */
function sentenceList(text) {
  const out = [];
  const re = /([^.!?]+[.!?])(?:\s+|$)/g;
  let match;
  while ((match = re.exec(text))) out.push(match[1].trim());
  return out;
}

/**
 * Words a trim must not end on — a note ending "... luxury vehicles and"
 * reads like a bug, and the fix costs one regex pass.
 */
const TRAILING_STOPWORDS =
  /\s+(?:and|or|but|with|without|the|a|an|to|of|in|on|at|by|from|as|for|that|which|its|his|her|their|this|these|those)$/i;

function trimTo(text, maxChars) {
  const trimmed = String(text).trim();
  if (trimmed.length <= maxChars) return trimmed;

  const slice = trimmed.slice(0, maxChars);
  let out = (slice.slice(0, slice.lastIndexOf(' ')) || slice).replace(/[,;:.\s]+$/, '');
  let previous;
  do {
    previous = out;
    out = out.replace(TRAILING_STOPWORDS, '').replace(/[,;:\s]+$/, '');
  } while (out !== previous);
  return out;
}

/** Markdown link labels break on brackets; titles are data, so escape them. */
function linkLabel(text) {
  return String(text || '')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/\[/g, '(')
    .replace(/\]/g, ')');
}

/** Group tours by the destination a `?place=` page can actually resolve. */
function destinations(tours) {
  const counts = new Map();
  for (const tour of tours || []) {
    const raw = (tour.city || '').trim();
    if (!raw) continue;
    const city = CITY_ALIASES[raw] || raw;
    // Skip raw administrative names that were not aliased; a district is a
    // worse landing page than the city and the sitemap already covers it.
    if (/\b(District|Municipal)\b/.test(city)) continue;
    counts.set(city, (counts.get(city) || 0) + 1);
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .map(([city, count]) => ({ city, count }));
}

function tourUrl(tour) {
  return tour.slug
    ? `${SITE_URL}/tour/${encodeURIComponent(tour.id)}/${encodeURIComponent(tour.slug)}`
    : `${SITE_URL}/tour/${encodeURIComponent(tour.id)}`;
}

/**
 * Build the whole file from already-fetched data. Pure so the unit suite can
 * exercise the formatting without a network call or a write to public/.
 */
function buildLlmsTxt({ tours = [], articles = [], siteUrl = SITE_URL }) {
  const catalogue = tours.filter((t) => t && t.id && t.title);
  const range = priceRange(catalogue);
  const places = destinations(catalogue);

  const priceLine = range
    ? range.currency
      ? `${formatMoney(range.min, range.currency)}–${formatMoney(range.max, range.currency)} per person`
      : `${range.min}–${range.max} per person`
    : null;

  const summaryParts = [
    `Travio Ghana sells ${catalogue.length} curated Ghana tours and experiences`,
    priceLine ? `from ${formatMoney(range.min, range.currency || 'USD')} to ${formatMoney(range.max, range.currency || 'USD')} per person` : null,
  ].filter(Boolean);

  const lines = [];
  lines.push('# Travio Ghana', '');
  lines.push(
    `> ${summaryParts.join(', ')}. The catalogue covers Accra city tours and food experiences, Cape Coast and Elmina castles, Kakum and Mole safaris, Ashanti heritage in Kumasi, the Nzulezo stilt village and Volta waterfalls.`
  );
  lines.push('');
  lines.push(
    'Travio Ghana is operated by Expedition-Go Tours Ltd in Accra, Ghana. Every tour page linked below carries the full itinerary, what is included and excluded, the pickup or meeting point, cancellation terms and the live price. Prices are per person in USD unless a page says otherwise.'
  );
  lines.push('');

  // Key facts as a plain list: easy for a model to quote without parsing prose.
  lines.push('Key facts:', '');
  lines.push(`- Website: ${siteUrl}`);
  lines.push(`- Tours: ${catalogue.length}`);
  if (priceLine) lines.push(`- Price range: ${priceLine}`);
  lines.push(`- Currency: ${range && range.currency ? range.currency : 'USD'}`);
  lines.push('- Operator: Expedition-Go Tours Ltd, Accra, Ghana');
  lines.push('- Support: support@travioghana.com');
  if (places.length) {
    lines.push(`- Destinations: ${places.slice(0, 8).map((p) => p.city).join(', ')}`);
  }
  lines.push(`- Sitemap: ${siteUrl}/sitemap.xml`);
  lines.push('');

  // Catalogue.
  lines.push('## Tours', '');
  for (const tour of catalogue) {
    const note = summarise(tour.description).replace(/[.!?]+$/, '');
    const price = formatMoney(tour.startingPrice, tour.currency || 'USD');
    const suffix = price ? ` From ${price} per person.` : '';
    lines.push(`- [${linkLabel(tour.title)}](${tourUrl(tour)})${note ? `: ${note}.` : '.'}${suffix}`);
  }
  lines.push('');

  // Destination listings — the ?place= pages that rank for "X tours".
  if (places.length) {
    lines.push('## Destinations', '');
    for (const place of places) {
      lines.push(`- [${linkLabel(place.city)} tours](${siteUrl}/tours?place=${encodeURIComponent(place.city)})`);
    }
    lines.push('');
  }

  // Guides — the blog is what earns informational queries.
  lines.push('## Guides', '');
  for (const article of articles) {
    if (!article || !article.slug || !article.title) continue;
    const note = summarise(article.excerpt, 260).replace(/[.!?]+$/, '');
    const date = isoDate(article.publishedAt);
    const suffix = date ? ` (${date})` : '';
    lines.push(`- [${linkLabel(article.title)}](${siteUrl}/blog/${encodeURIComponent(article.slug)})${note ? `: ${note}.` : '.'}${suffix}`);
  }
  lines.push(`- [${BLOG_INDEX.label}](${siteUrl}${BLOG_INDEX.path})`);
  lines.push('');

  const section = (name, key) => {
    const entries = PAGE_LINKS.filter((p) => p.section === key);
    if (entries.length === 0) return;
    lines.push(`## ${name}`, '');
    for (const entry of entries) {
      lines.push(`- [${linkLabel(entry.label)}](${siteUrl}${entry.path})${entry.note ? `: ${entry.note}` : ''}`);
    }
    lines.push('');
  };

  section('Book', 'book');
  section('Company', 'company');
  section('Optional', 'optional');

  return `${lines.join('\n').trimEnd()}\n`;
}

function isoDate(value) {
  if (!value) return '';
  const d = new Date(value);
  if (isNaN(d.getTime())) return '';
  return d.toISOString().split('T')[0];
}

async function fetchCatalogue() {
  const tours = [];
  let total = null;
  for (let page = 1; page <= MAX_PAGES; page++) {
    const data = await fetchJson(`${API_URL}/tours?limit=${PAGE_SIZE}&page=${page}`);
    if (page === 1) total = data?.pagination?.totalCount ?? null;
    const rows = data?.data?.tours || [];
    for (const listing of rows) {
      const tour = listing.tour || listing;
      if (tour?.id && tour?.title) tours.push(tour);
    }
    if (rows.length < PAGE_SIZE) break;
    if (page === MAX_PAGES) {
      console.warn(`WARN: catalogue still full after ${MAX_PAGES} pages — llms.txt lists ${tours.length} tours.`);
    }
  }
  if (total != null && total !== tours.length) {
    console.warn(`WARN: llms.txt covers ${tours.length}/${total} active tours.`);
  }
  return tours;
}

async function fetchArticles() {
  const articles = [];
  for (let page = 1; page <= MAX_PAGES; page++) {
    const data = await fetchJson(`${BLOG_URL}/articles?limit=${PAGE_SIZE}&page=${page}`);
    const rows = data?.data?.articles || [];
    for (const a of rows) if (a?.slug && a?.title) articles.push(a);
    if (rows.length < PAGE_SIZE) break;
  }
  return articles;
}

async function main() {
  console.log(`Generating llms.txt from ${API_URL} -> ${OUTPUT}`);

  let tours;
  try {
    tours = await fetchCatalogue();
  } catch (err) {
    console.error(`ERROR: could not fetch the catalogue: ${err.message}`);
    if (fs.existsSync(OUTPUT)) {
      console.error('Refusing to overwrite the existing llms.txt — keeping the last good version.');
      process.exit(0);
    }
    console.error('No existing llms.txt to fall back to — leaving it absent rather than publishing an empty catalogue.');
    process.exit(0);
  }

  if (tours.length === 0) {
    console.error('ERROR: the catalogue returned zero tours; refusing to overwrite llms.txt.');
    process.exit(0);
  }

  // The blog is a bonus: a broken fetch ships the catalogue without guides
  // rather than failing the build over six links.
  let articles = [];
  try {
    articles = await fetchArticles();
  } catch (err) {
    console.error(`WARN: could not fetch blog articles: ${err.message}`);
  }

  const txt = buildLlmsTxt({ tours, articles });
  fs.mkdirSync(path.dirname(OUTPUT), { recursive: true });
  fs.writeFileSync(OUTPUT, txt, 'utf8');
  console.log(
    `llms.txt written: ${tours.length} tours, ${articles.length} guides, ` +
      `${destinations(tours).length} destinations — ${(Buffer.byteLength(txt) / 1024).toFixed(1)} KB`
  );
}

module.exports = {
  buildLlmsTxt,
  priceRange,
  summarise,
  destinations,
  formatMoney,
  linkLabel,
  tourUrl,
  CITY_ALIASES,
  PAGE_LINKS,
  BLOG_INDEX,
  OUTPUT,
};

if (require.main === module) {
  main().catch((err) => {
    console.error('FATAL:', err.message);
    process.exit(1);
  });
}
