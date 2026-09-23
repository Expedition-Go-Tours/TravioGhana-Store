#!/usr/bin/env node
/**
 * In-place image optimisation for the repo's oversized static assets.
 *
 * The source images are print-resolution originals (up to 6240x4160) that were
 * being shipped byte-for-byte, including a 683 KB PNG logo rendered at 20 px
 * and a 3.4 MB hero rendered at viewport width. This script downscales each to
 * a sane display-appropriate width and re-encodes with quality settings chosen
 * per format, keeping filenames/imports untouched.
 *
 * Originals remain recoverable from git history. Run: node scripts/optimize-images.cjs
 */

const fs = require('node:fs')
const path = require('node:path')
const sharp = require('sharp')

const ROOT = path.resolve(__dirname, '..')

const TARGETS = [
  // Logos/badges rendered tiny — the biggest waste in the bundle.
  { file: 'public/travio_logo.png', width: 192, kind: 'png' },
  { file: 'public/logo.png', width: 320, kind: 'png' },
  { file: 'src/assets/expo_trans.png', width: 300, kind: 'png' },
  { file: 'src/assets/icons/User Circle.png', width: 160, kind: 'png' },
  // Route heroes (max ~2x mobile/desktop viewport width).
  { file: 'src/assets/images/painting.webp', width: 1920, kind: 'webp', quality: 74 },
  { file: 'src/assets/images/IMG_3538.webp', width: 1920, kind: 'webp', quality: 74 },
  { file: 'src/assets/IMG_3538.webp', width: 1920, kind: 'webp', quality: 74 },
  { file: 'src/assets/newsletter-hero.jpg', width: 1600, kind: 'jpeg', quality: 74 },
  // Auth slider / supplier gallery source images.
  { file: 'public/Image01.webp', width: 914, kind: 'webp', quality: 76 },
  { file: 'public/Image02.webp', width: 1400, kind: 'webp', quality: 72 },
  { file: 'public/Image03.webp', width: 1400, kind: 'webp', quality: 72 },
  { file: 'public/Image04.webp', width: 1000, kind: 'webp', quality: 72 },
  { file: 'src/assets/Image01.webp', width: 914, kind: 'webp', quality: 76 },
  { file: 'src/assets/Image02.webp', width: 1400, kind: 'webp', quality: 72 },
  { file: 'src/assets/Image03.webp', width: 1400, kind: 'webp', quality: 72 },
  { file: 'src/assets/Image04.webp', width: 1000, kind: 'webp', quality: 72 },
]

function encode(pipeline, target) {
  if (target.kind === 'png') return pipeline.png({ compressionLevel: 9, effort: 8 })
  if (target.kind === 'jpeg') return pipeline.jpeg({ quality: target.quality, mozjpeg: true })
  return pipeline.webp({ quality: target.quality })
}

async function main() {
  let saved = 0
  for (const target of TARGETS) {
    const file = path.join(ROOT, target.file)
    if (!fs.existsSync(file)) {
      console.log(`[skip] ${target.file} (missing)`)
      continue
    }
    const before = fs.statSync(file).size
    const metadata = await sharp(file).metadata()
    const buffer = await encode(
      sharp(file).rotate().resize({ width: target.width, withoutEnlargement: true }),
      target,
    ).toBuffer()
    if (buffer.length >= before) {
      console.log(`[keep] ${target.file} (${Math.round(before / 1024)} KB — re-encode larger)`)
      continue
    }
    // Write via temp + copy over with retries: Windows indexers/AV/OneDrive
    // can hold a transient lock on large files. When the in-process copy
    // cannot complete, the temp file is kept for a manual `Move-Item -Force`.
    const tmp = `${file}.opt-tmp`
    fs.writeFileSync(tmp, buffer)
    let copied = false
    for (let attempt = 0; attempt < 5 && !copied; attempt += 1) {
      try {
        fs.copyFileSync(tmp, file)
        copied = true
      } catch {
        await new Promise((resolve) => setTimeout(resolve, 300))
      }
    }
    if (!copied) {
      console.log(`[lock] ${target.file} — kept ${path.basename(tmp)} for manual move`)
      continue
    }
    fs.rmSync(tmp, { force: true })
    const savedKb = Math.round((before - buffer.length) / 1024)
    saved += buffer.length - before
    console.log(
      `[opt]  ${target.file}  ${metadata.width}px/${Math.round(before / 1024)} KB` +
        ` -> ${Math.min(metadata.width ?? target.width, target.width)}px/${Math.round(buffer.length / 1024)} KB` +
        `  (-${savedKb} KB)`,
    )
  }
  console.log(`\ntotal saved: ${Math.round(-saved / 1024)} KB`)
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
