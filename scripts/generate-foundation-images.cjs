/**
 * Generates the Foundation page's optimized image set.
 *
 * The page hot-linked all thirteen photographs from Wikimedia Commons through
 * `Special:FilePath`, which answers with a cross-origin redirect to
 * thumb.wikimedia.org / upload.wikimedia.org. Production serves a
 * Content-Security-Policy whose `img-src` lists `commons.wikimedia.org` but not
 * the redirect target, so 30 of the page's 33 <img> elements were blocked there
 * and the page rendered without a single photograph. Measured over the wire,
 * the set was also 5.45 MB of Commons JPEGs behind two redirects each (one
 * `Ghana tree planting.jpg?width=1100` alone is 829 KB), re-fetched for every
 * visitor because a third-party origin cannot be cached as this site's own.
 *
 * This follows generate-partnership-images.cjs and
 * generate-travel-agent-images.cjs: download the Commons originals once into
 * `scripts/.cache/` (gitignored), resize to the real display footprint at 2x
 * DPR, and write hashed-by-Vite WebPs into `src/assets/foundation/`.
 *
 * Widths come from the measured boxes and each source's `object-fit: cover`
 * behaviour — a landscape source in a squarer box is height-bound (so the
 * source must be wide enough to supply the height), a portrait source is
 * width-bound. Display sizes were measured at 1920/1440/1024/390 px; the
 * largest figure per slot is used. The page's existing photography credits
 * already carry the attribution for every file (all Public domain, CC0, CC BY
 * 4.0 or CC BY-SA 4.0 per the Commons API), so they are left as they are.
 *
 * Run with: node scripts/generate-foundation-images.cjs
 */
const fs = require('node:fs')
const path = require('node:path')
const sharp = require('sharp')

const ROOT = path.resolve(__dirname, '..')
const OUT_DIR = path.join(ROOT, 'src', 'assets', 'foundation')
const CACHE_DIR = path.join(__dirname, '.cache', 'foundation')

const WIKIMEDIA = 'https://commons.wikimedia.org/wiki/Special:FilePath/'
// Commons asks automated clients to identify themselves; anonymous bursts get
// throttled (or answered with an HTML error page that sharp then rejects).
const USER_AGENT =
  'TravioGhana-Store-image-builder/1.0 (https://www.travioghana.com; info@expeditiongotours.com)'

/**
 * `width` is the encode width; `downloadWidth` the Commons rendition to fetch
 * (kept above the encode width so the resize always has real pixels).
 *
 * Boxes (CSS px, largest measured): hero lanes 283x268 / 222x195,
 * help cards 591x480, impact shots 376x401, volunteer 599x670.
 *
 * The four big photos (help cards, volunteer panel, the impact landscape) sit
 * at roughly 0.8-1.0x of a full 2x render with these widths; the encodings were
 * compared side by side and the extra pixels cost more than they showed. The
 * set totals ~1.2 MB against the 5.45 MB of Commons JPEGs it replaces.
 */
const JOBS = [
  // Hero gallery, lane 1 — square-ish boxes; the landscape/portrait mix decides
  // which side binds.
  { slug: 'school-children', file: 'Ghana%20school%20children%20%288203372110%29.jpg', out: 'school-children.webp', downloadWidth: 1400, width: 900, quality: 68 },
  { slug: 'tree-planting-9', file: 'Tree%20planting%20in%20Ghana%209.jpg', out: 'tree-planting-9.webp', downloadWidth: 1400, width: 900, quality: 68 },
  { slug: 'community-clean-up', file: 'Community%20clean-up.jpg', out: 'community-clean-up.webp', downloadWidth: 1000, width: 700, quality: 68 },
  // Hero gallery, lane 2 — narrower boxes than lane 1.
  { slug: 'market-women', file: 'Market%20women%20in%20Ghana.jpg', out: 'market-women.webp', downloadWidth: 1000, width: 700, quality: 68 },
  { slug: 'village-meeting', file: 'A%20village%20community%20development%20meeting%20in%20northern%20Ghana.jpg', out: 'village-meeting.webp', downloadWidth: 1200, width: 800, quality: 64 },
  { slug: 'teacher-reading', file: 'A%20teacher%20assisting%20his%20student%20to%20read.jpg', out: 'teacher-reading.webp', downloadWidth: 900, width: 600, quality: 68 },
  // Request-support cards — the page's largest images.
  { slug: 'students-reading', file: 'Students%20reading%20in%20a%20classroom.jpg', out: 'students-reading.webp', downloadWidth: 1800, width: 1400, quality: 62 },
  { slug: 'wali-meeting', file: 'Wali_physical_meeting.jpg', out: 'wali-meeting.webp', downloadWidth: 1600, width: 1200, quality: 62 },
  // Impact track — landscape sources must supply the full 401px height, the two
  // portrait ones are width-bound instead.
  { slug: 'cleanup-9', file: 'Cleanup%20exercise%20in%20Ghana%209.jpg', out: 'cleanup-9.webp', downloadWidth: 1400, width: 1100, quality: 64 },
  { slug: 'schoolgirl', file: 'Schoolgirl%20Ghana.jpg', out: 'schoolgirl.webp', downloadWidth: 900, width: 600, quality: 68 },
  { slug: 'tree-planting', file: 'Ghana%20tree%20planting.jpg', out: 'tree-planting.webp', downloadWidth: 1000, width: 640, quality: 62 },
  { slug: 'young-women', file: 'Ghana%20young%20women%20%287250530402%29.jpg', out: 'young-women.webp', downloadWidth: 900, width: 600, quality: 66 },
  // Volunteer panel — portrait box (0.89) cut from a 1.33 landscape, so the
  // height is what the encode has to cover.
  { slug: 'cleanup-4', file: 'Cleanup%20exercise%20in%20Ghana%204.jpg', out: 'cleanup-4.webp', downloadWidth: 2000, width: 1400, quality: 62 },
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

  console.log(`\nFoundation image set total: ${Math.round(total / 1024)}KB`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
