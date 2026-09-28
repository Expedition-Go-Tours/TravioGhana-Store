/**
 * Generates the Partnerships page's optimized image set.
 *
 * The page used to hot-link all thirteen photos from Wikimedia Commons through
 * `Special:FilePath` — two cross-origin redirects per image and 3.8 MB of
 * JPEGs delivered from a third-party origin (measured: 105 KB–647 KB per card,
 * 2.5–16 s each on a typical connection). The rail then requested them twice
 * (the marquee renders the set twice), so cards popped in one at a time.
 *
 * This script downloads the Commons originals once into `scripts/.cache/`
 * (gitignored), resizes them to their real display footprint (2x DPR) and
 * writes hashed-by-Vite WebPs into `src/assets/partnerships/`. Re-runs are
 * offline as long as the cache exists. Attribution stays on the page.
 *
 * The greeting photograph is not a Commons asset: it was supplied by
 * Expedition-Go Tours and used to live in `public/partnerships/material.jpg`.
 * It now lives in `scripts/assets/partnerships/` as a generator input so the
 * 452 KB original is no longer copied into the build output.
 *
 * Run with: node scripts/generate-partnership-images.cjs
 */
const fs = require('node:fs')
const path = require('node:path')
const sharp = require('sharp')

const ROOT = path.resolve(__dirname, '..')
const OUT_DIR = path.join(ROOT, 'src', 'assets', 'partnerships')
const CACHE_DIR = path.join(__dirname, '.cache', 'partnerships')
const MATERIAL_SRC = path.join(__dirname, 'assets', 'partnerships', 'material.jpg')

const WIKIMEDIA = 'https://commons.wikimedia.org/wiki/Special:FilePath/'
// Commons asks automated clients to identify themselves; anonymous bursts get
// throttled (or answered with an HTML error page that sharp then rejects).
const USER_AGENT =
  'TravioGhana-Store-image-builder/1.0 (https://www.travioghana.com; info@expeditiongotours.com)'

/**
 * Cards render at 318x420 CSS px (`--route-card` width) and are cropped by
 * `object-fit: cover`, so 640 px wide (2x) is the whole story. The hero is
 * displayed up to ~600 px wide inside the tilted frame; 1200 px is 2x.
 */
const JOBS = [
  { slug: 'cape-coast-castle', file: 'Cape_Coast_Castle.jpg', out: 'cape-coast-castle.webp', width: 640, quality: 68 },
  { slug: 'accra-skyline', file: 'Accra_Skyline_-_Ghana.jpg', out: 'accra-skyline.webp', width: 640, quality: 68 },
  { slug: 'makola-market', file: 'Street_Outside_Makola_Market%2C_Accra%2C_Ghana.JPG', out: 'makola-market.webp', width: 640, quality: 68 },
  { slug: 'kakum-canopy-walkway', file: 'Canopy_Walkway_Kakum_National_Park.jpg', out: 'kakum-canopy-walkway.webp', width: 640, quality: 68 },
  { slug: 'accra-taxi', file: 'Taxi-accra.jpg', out: 'accra-taxi.webp', width: 640, quality: 68 },
  { slug: 'wli-waterfall', file: 'Wli_Agumatse_Waterfall_aerial_view.jpg', out: 'wli-waterfall.webp', width: 640, quality: 68 },
  { slug: 'bojo-beach', file: 'People_at_the_bojo_beach_resort.jpg', out: 'bojo-beach.webp', width: 640, quality: 68 },
  { slug: 'kente-weaving', file: 'Kente_weaving_in_Ghana.jpg', out: 'kente-weaving.webp', width: 640, quality: 68 },
  { slug: 'shai-hills', file: 'Shai_Hills_Ghana.jpg', out: 'shai-hills.webp', width: 640, quality: 68 },
  { slug: 'waakye', file: 'Waakye%2C_a_delicious_delicacy_in_Ghana.jpg', out: 'waakye.webp', width: 640, quality: 68 },
  { slug: 'aburi-gardens', file: 'Aburi_Botanical_Gardens.jpg', out: 'aburi-gardens.webp', width: 640, quality: 68 },
  { slug: 'volta-lake', file: 'Volta_Lake_01.jpg', out: 'volta-lake.webp', width: 640, quality: 68 },
  { slug: 'elmina-castle', file: 'Elmina_Castle_-_Ghana.jpg', out: 'elmina-castle.webp', downloadWidth: 1400, width: 1200, quality: 74 },
]

async function fetchSource(job) {
  const cached = path.join(CACHE_DIR, `${job.slug}.jpg`)
  if (fs.existsSync(cached)) return cached

  const url = `${WIKIMEDIA}${job.file}?width=${job.downloadWidth || 1200}`
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
    .webp({ quality, effort: 5 })
    .toFile(outPath)
  const before = fs.statSync(srcPath).size
  console.log(
    `${path.basename(outPath).padEnd(26)} ${String(Math.round(before / 1024)).padStart(5)}KB -> ` +
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

  if (!fs.existsSync(MATERIAL_SRC)) {
    console.error(`  MISSING  ${path.relative(ROOT, MATERIAL_SRC)}`)
    process.exitCode = 1
  } else {
    total += await encode(MATERIAL_SRC, path.join(OUT_DIR, 'material.webp'), 1200, 74)
  }

  console.log(`\nPartnerships image set total: ${Math.round(total / 1024)}KB`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
