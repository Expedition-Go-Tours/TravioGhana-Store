/**
 * Generates the Travel Agents page's optimized image set.
 *
 * The page hot-linked its four photographs from Wikimedia Commons through
 * `Special:FilePath`, which answers with a cross-origin redirect to
 * thumb.wikimedia.org / upload.wikimedia.org. Production serves a
 * Content-Security-Policy whose `img-src` lists `commons.wikimedia.org` but not
 * the redirect target, so every one of them was blocked there: the hero frame
 * rendered empty (broken-image icon and alt text) and the three destination
 * cards rendered as blank dark-green tiles. The browser console reported it as
 * a CSP violation on the thumb.wikimedia.org URL, and /foundation, which still
 * hot-links the same way, is broken with it.
 *
 * This is the same treatment the Partnerships page already received (see
 * generate-partnership-images.cjs): download the Commons originals once into
 * `scripts/.cache/` (gitignored), resize them to their real display footprint
 * at 2x DPR and write hashed-by-Vite WebPs into `src/assets/travel-agents/`.
 * Same-origin files satisfy `img-src 'self'`, arrive without two third-party
 * redirects each, and can be cached immutably. Attribution stays on the page;
 * all four files are CC BY-SA 4.0 (checked through the Commons API).
 *
 * Run with: node scripts/generate-travel-agent-images.cjs
 */
const fs = require('node:fs')
const path = require('node:path')
const sharp = require('sharp')

const ROOT = path.resolve(__dirname, '..')
const OUT_DIR = path.join(ROOT, 'src', 'assets', 'travel-agents')
const CACHE_DIR = path.join(__dirname, '.cache', 'travel-agents')

const WIKIMEDIA = 'https://commons.wikimedia.org/wiki/Special:FilePath/'
// Commons asks automated clients to identify themselves; anonymous bursts get
// throttled (or answered with an HTML error page that sharp then rejects).
const USER_AGENT =
  'TravioGhana-Store-image-builder/1.0 (https://www.travioghana.com; info@expeditiongotours.com)'

/**
 * The hero sits in the portrait `.portrait-frame`, which renders ~506x574 CSS
 * px at the widest. The source is landscape (1.5:1), so `object-fit: cover`
 * keeps the full height and only a vertical strip of the width — a 2x render
 * needs ~1148 source pixels of height, i.e. ~1722 of width. 1600 is the
 * closest useful encode; 2000 is fetched so the resize has real pixels to
 * work from.
 *
 * The destination cards render 389x440 (ratio 0.88). Which side `cover` crops
 * depends on the source: landscape sources are height-bound (a 2x render needs
 * ~880px of height), the portrait Aburi is width-bound (a 2x render needs
 * ~778px of width). Widths below follow from that; qualities were picked by
 * re-encoding each photo and comparing, since detail differs a lot between
 * them (Kakum's canopy is the expensive one).
 */
const JOBS = [
  { slug: 'accra-skyline', file: 'Accra_Skyline_-_Ghana.jpg', out: 'accra-skyline.webp', downloadWidth: 2000, width: 1600, quality: 72 },
  { slug: 'cape-coast-castle', file: 'The_Cape_Coast_Castle_located_in_Cape_Coast_Ghana.jpg', out: 'cape-coast-castle.webp', downloadWidth: 1600, width: 1200, quality: 66 },
  { slug: 'kakum-canopy-walkway', file: 'Canopy_walkway_in_Kakum_National_Park.jpg', out: 'kakum-canopy-walkway.webp', downloadWidth: 1600, width: 1000, quality: 60 },
  { slug: 'aburi-botanical-gardens', file: 'Aburi_Botanical_Gardens_11.jpg', out: 'aburi-botanical-gardens.webp', downloadWidth: 1600, width: 800, quality: 64 },
]

async function fetchSource(job) {
  const cached = path.join(CACHE_DIR, `${job.slug}.jpg`)
  if (fs.existsSync(cached)) return cached

  const url = `${WIKIMEDIA}${job.file}?width=${job.downloadWidth}`
  const response = await fetch(url, {
    headers: { 'user-agent': USER_AGENT, accept: 'image/jpeg,image/png,image/*' },
    redirect: 'follow',
  })
  if (!response.ok) throw new Error(`HTTP ${response.status} for ${url}`)

  fs.mkdirSync(CACHE_DIR, { recursive: true })
  fs.writeFileSync(cached, Buffer.from(await response.arrayBuffer()))
  return cached
}

async function encode(srcPath, outPath, width, quality) {
  const info = await sharp(srcPath)
    .rotate()
    .resize({ width, withoutEnlargement: true })
    .webp({ quality, effort: 6 })
    .toFile(outPath)
  const before = fs.statSync(srcPath).size
  console.log(
    `${path.basename(outPath).padEnd(28)} ${String(Math.round(before / 1024)).padStart(5)}KB -> ` +
      `${String(Math.round(info.size / 1024)).padStart(4)}KB  ${info.width}x${info.height}`,
  )
  return info.size
}

async function main() {
  fs.mkdirSync(OUT_DIR, { recursive: true })
  let total = 0

  for (const job of JOBS) {
    const srcPath = await fetchSource(job)
    total += await encode(srcPath, path.join(OUT_DIR, job.out), job.width, job.quality)
  }

  console.log(`\nTravel agents image set total: ${Math.round(total / 1024)}KB`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
