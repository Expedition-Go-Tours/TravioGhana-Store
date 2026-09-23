/**
 * Generates the About Us page's optimized image set.
 *
 * The About page previously shipped ~8 MB of images (some 20-22 MP originals
 * rendered inside 240px cards). The shared source assets are used by other
 * pages at larger sizes, so instead of touching them we emit About-only
 * variants sized to their real display footprint (2x DPR) into
 * `src/assets/about/`.
 *
 * Run with: node scripts/generate-about-images.cjs
 */
const fs = require('fs')
const path = require('path')
const sharp = require('sharp')

const ROOT = path.resolve(__dirname, '..')
const OUT_DIR = path.join(ROOT, 'src', 'assets', 'about')

/**
 * `height` targets are for the hero marquee (sized by height, width auto);
 * `width` targets are for the grid tiles (sized by width).
 */
const JOBS = [
  // Hero marquee — displayed 420-520px tall, 2x DPR headroom.
  { src: 'src/assets/Image01.webp', out: 'hero-1.webp', height: 900 },
  { src: 'src/assets/Image02.webp', out: 'hero-2.webp', height: 900 },
  { src: 'src/assets/Image03.webp', out: 'hero-3.webp', height: 900 },
  { src: 'src/assets/Image04.webp', out: 'hero-4.webp', height: 900 },

  // Story mosaic — displayed 160-320px wide.
  { src: 'src/assets/traditional.png', out: 'story-1.webp', width: 720 },
  { src: 'src/assets/caption.jpg', out: 'story-2.webp', width: 720 },
  { src: 'src/assets/ec.jpg', out: 'story-3.webp', width: 720 },
  { src: 'src/assets/images/IMG_3538.webp', out: 'story-4.webp', width: 720 },

  // Category bento — displayed up to ~520px wide.
  { src: 'src/assets/images/painting.webp', out: 'category-tour.webp', width: 1040 },
  { src: 'src/assets/images/QuadBiking.webp', out: 'category-activity.webp', width: 900 },
  { src: 'src/assets/images/IMG_3538.webp', out: 'category-transport.webp', width: 900 },
  { src: 'src/assets/Akosombo.jpg', out: 'category-akosombo.webp', width: 900 },
]

async function main() {
  fs.mkdirSync(OUT_DIR, { recursive: true })

  let total = 0
  for (const job of JOBS) {
    const srcPath = path.join(ROOT, job.src)
    if (!fs.existsSync(srcPath)) {
      console.error(`  MISSING  ${job.src}`)
      process.exitCode = 1
      continue
    }

    const resize = job.height ? { height: job.height } : { width: job.width }
    const outPath = path.join(OUT_DIR, job.out)

    const info = await sharp(srcPath)
      .rotate()
      .resize({ ...resize, withoutEnlargement: true, fit: 'inside' })
      .webp({ quality: 76, effort: 5 })
      .toFile(outPath)

    const before = fs.statSync(srcPath).size
    total += info.size
    console.log(
      `${job.out.padEnd(26)} ${String(Math.round(before / 1024)).padStart(5)}KB -> ` +
        `${String(Math.round(info.size / 1024)).padStart(4)}KB  ${info.width}x${info.height}`,
    )
  }

  console.log(`\nAbout image set total: ${Math.round(total / 1024)}KB`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
