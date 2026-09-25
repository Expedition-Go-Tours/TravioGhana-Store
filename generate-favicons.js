#!/usr/bin/env node
/**
 * TravioGhana icon pipeline. Run with `npm run generate-favicons`.
 *
 * Source of truth: src/assets/TravioGhana_Badge.png — the badge cut-out
 * (1253x1253, transparent corners), used *exactly as supplied*:
 *
 *   tab sizes (16/32/48/64) + the .ico payloads
 *        a plain resize of the whole image, transparency kept so the disc
 *        composites onto whatever colour the browser chrome is
 *   apple-touch-icon (180), android-chrome (192/512)
 *        the same image flattened onto white, because iOS and Android's
 *        adaptive-icon mask both require an opaque icon
 *   maskable-512x512
 *        the same image at MASKABLE_FILL so Android's mask never reaches the
 *        wordmark or the flag wave
 *
 * Nothing is cropped, masked off or recoloured — an earlier revision of this
 * script rebuilt the tab icons from the emblem alone to keep them legible at
 * 16px, which is not what the brand team asked for.
 *
 * The one exception is /logo.png, which stays the emblem on ivory: it renders
 * at 40-56px beside the splash screen's own wordmark and backs the
 * Organization schema's declared 512x512 ImageObject.
 *
 * Every file is written twice:
 *   public/icons/v2/<name>   versioned, declared by the HTML heads, immutable
 *   public/<name>            the legacy paths probes and old references hit
 * Both copies come from this one script, so they cannot drift apart.
 *
 * The versioned URLs are what removes favicon lag. Icon stores (Safari's icon
 * database, Chrome's favicon service, Firefox's favicons.sqlite) key on the
 * icon URL rather than on Cache-Control, so a URL that has never existed
 * cannot be served from a stale entry. Bump ICON_VERSION in
 * scripts/icon-links.cjs *and* the folder below only when v2 has already been
 * deployed — while it is still unpublished the artwork can change in place.
 *
 * Deliberately does NOT write public/site.webmanifest: an earlier version of
 * this script regenerated it with the retired "Expedition-Go Tours" branding,
 * silently overwriting the correct Travio Ghana manifest. The manifest is
 * hand-maintained now and verified by scripts/check-icons.cjs.
 *
 * Deliberately avoids sharp's `effort` and `palette` PNG options: in sharp
 * 0.35 both are lossy on this artwork (measured max channel delta 50+), and
 * the brand marks must stay exact.
 */
import sharp from 'sharp'
import { mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)))

const SRC = resolve(ROOT, 'src/assets/TravioGhana_Badge.png')
const WHITE = '#FFFFFF'
const IVORY = '#F8F8F0'

/**
 * Emblem crop, as fractions of the canvas so a re-export at another
 * resolution still lines up. Measured by ink scan on the 1253px export:
 *   emblem          x 299-953, y 187-712
 *   wordmark starts y 720  (the dot of "Travio"'s i — the crop must stop short)
 * then padded by 8px and normalised.
 */
const EMBLEM_CROP = { left: 0.23224, top: 0.14286, width: 0.53472, height: 0.42618 }
/** Emblem crop width as a fraction of the /logo.png canvas. */
const EMBLEM_FILL = 0.918
/** Maskable artwork width as a fraction of the canvas — inside Android's 80% safe circle. */
const MASKABLE_FILL = 0.78

const png = (opts = {}) => ({ compressionLevel: 9, ...opts })

function assert(condition, message) {
  if (!condition) throw new Error(message)
}

async function readSource() {
  const meta = await sharp(SRC).metadata()
  assert(
    meta.width === meta.height,
    `${SRC} is ${meta.width}x${meta.height}; every icon is a square resize, so the source must be square.`,
  )
  if (meta.width < 1024) {
    console.warn(
      `  warn ${SRC} is only ${meta.width}px; the 512px icons will be upscaled from ` +
        'a small source. Re-export at 1024px or larger when convenient.',
    )
  }
  return meta.width
}

/** The badge exactly as supplied, scaled. Transparency survives. */
const scaledIcon = (size) =>
  sharp(SRC).resize(size, size, { kernel: 'lanczos3' }).png(png()).toBuffer()

/** The badge on an opaque background — the mask and iOS both need that. */
const flatIcon = (size) =>
  sharp(SRC)
    .resize(size, size, { kernel: 'lanczos3' })
    .flatten({ background: WHITE })
    .png(png())
    .toBuffer()

/** The badge inset so Android's mask cannot reach the wordmark. */
async function maskableIcon(size) {
  const inner = await sharp(SRC)
    .resize(Math.round(size * MASKABLE_FILL), Math.round(size * MASKABLE_FILL), {
      kernel: 'lanczos3',
    })
    .png()
    .toBuffer()
  // sharp's `composite` always promotes to RGBA, so the result is flattened in
  // a second pass (within one pipeline the fixed operation order would let the
  // composite undo the flatten and leave transparent corners for iOS to render
  // against black).
  const composed = await sharp({
    create: { width: size, height: size, channels: 3, background: WHITE },
  })
    .composite([{ input: inner, gravity: 'center' }])
    .png()
    .toBuffer()
  return sharp(composed).flatten({ background: WHITE }).png(png()).toBuffer()
}

/** Emblem on ivory, for /logo.png only. */
async function emblemIcon(size) {
  const meta = await sharp(SRC).metadata()
  const crop = {
    left: Math.round(EMBLEM_CROP.left * meta.width),
    top: Math.round(EMBLEM_CROP.top * meta.height),
    width: Math.round(EMBLEM_CROP.width * meta.width),
    height: Math.round(EMBLEM_CROP.height * meta.height),
  }
  const emblem = await sharp(SRC)
    .extract(crop)
    .resize({ width: Math.max(1, Math.round(size * EMBLEM_FILL)), kernel: 'lanczos3' })
    .flatten({ background: IVORY })
    .png()
    .toBuffer()
  const composed = await sharp({
    create: { width: size, height: size, channels: 3, background: IVORY },
  })
    .composite([{ input: emblem, gravity: 'center' }])
    .png()
    .toBuffer()
  return sharp(composed).flatten({ background: IVORY }).png(png()).toBuffer()
}

/** Real multi-resolution ICO (PNG payloads), not a PNG with an .ico extension. */
function buildIco(entries) {
  const header = Buffer.alloc(6)
  header.writeUInt16LE(0, 0) // reserved
  header.writeUInt16LE(1, 2) // 1 = icon
  header.writeUInt16LE(entries.length, 4)

  const directory = Buffer.alloc(16 * entries.length)
  let offset = header.length + directory.length
  entries.forEach((entry, index) => {
    const at = index * 16
    const dim = entry.size >= 256 ? 0 : entry.size // 0 means 256
    directory.writeUInt8(dim, at)
    directory.writeUInt8(dim, at + 1)
    directory.writeUInt8(0, at + 2) // palette entries
    directory.writeUInt8(0, at + 3) // reserved
    directory.writeUInt16LE(1, at + 4) // colour planes
    directory.writeUInt16LE(32, at + 6) // bits per pixel
    directory.writeUInt32LE(entry.data.length, at + 8)
    directory.writeUInt32LE(offset, at + 12)
    offset += entry.data.length
  })

  return Buffer.concat([header, directory, ...entries.map((e) => e.data)])
}

/** Icons the platform composites itself, so transparency is fine and expected. */
const TRANSPARENT_BY_DESIGN = new Set([
  'favicon-16x16.png',
  'favicon-32x32.png',
  'favicon-48x48.png',
  'favicon-64.png',
  'favicon.ico',
])
/** Icons that must be opaque: iOS home screens and Android's mask. */
const MUST_BE_OPAQUE = new Set([
  'apple-touch-icon.png',
  'android-chrome-192x192.png',
  'android-chrome-512x512.png',
  'maskable-512x512.png',
])

async function main() {
  await readSource()

  const outputs = new Map()

  const tabIcons = [
    { name: 'favicon-16x16.png', size: 16 },
    { name: 'favicon-32x32.png', size: 32 },
    { name: 'favicon-48x48.png', size: 48 },
    { name: 'favicon-64.png', size: 64 },
  ]
  const tabRenders = new Map()
  for (const icon of tabIcons) {
    const data = await scaledIcon(icon.size)
    tabRenders.set(icon.size, data)
    outputs.set(icon.name, data)
  }
  // The .ico reuses the very renders the HTML declares, so the multi-size icon
  // can never disagree with the PNG the browser picks.
  outputs.set(
    'favicon.ico',
    buildIco([16, 32, 48].map((size) => ({ size, data: tabRenders.get(size) }))),
  )

  outputs.set('apple-touch-icon.png', await flatIcon(180))
  outputs.set('android-chrome-192x192.png', await flatIcon(192))
  outputs.set('android-chrome-512x512.png', await flatIcon(512))
  outputs.set('maskable-512x512.png', await maskableIcon(512))
  outputs.set('logo.png', await emblemIcon(512))

  const versioned = resolve(ROOT, 'public/icons/v2')
  mkdirSync(versioned, { recursive: true })

  // /logo.png keeps its stable, unversioned URL: app code imports the path, the
  // Organization schema publishes it, and nothing would ever request a
  // versioned twin of it.
  const LEGACY_ONLY = new Set(['logo.png'])

  const report = []
  for (const [name, data] of outputs) {
    assert(data?.length > 0, `${name} came out empty`)
    let sizeLabel = '16+32+48'
    if (name !== 'favicon.ico') {
      // sharp has no ICO decoder, so the multi-size container is trusted to the
      // byte-level assertions in scripts/check-icons.cjs.
      const meta = await sharp(data).metadata()
      assert(
        meta.width === meta.height,
        `${name} is ${meta.width}x${meta.height}; icons must be square`,
      )
      if (MUST_BE_OPAQUE.has(name)) {
        assert(meta.hasAlpha === false, `${name} must be opaque but still carries an alpha channel`)
      }
      if (TRANSPARENT_BY_DESIGN.has(name)) {
        assert(meta.hasAlpha === true, `${name} lost its transparency`)
      }
      sizeLabel = `${meta.width}x${meta.height}`
    }
    writeFileSync(resolve(ROOT, 'public', name), data)
    if (!LEGACY_ONLY.has(name)) writeFileSync(resolve(versioned, name), data)
    report.push({
      name,
      bytes: data.length,
      size: sizeLabel,
      written: LEGACY_ONLY.has(name) ? 'public/' : 'public/icons/v2/ + public/',
    })
  }

  // Retired asset: a 179-byte SVG wrapping a fixed-size raster of the old mark.
  rmSync(resolve(ROOT, 'public/favicon.svg'), { force: true })
  // Also retired: an early version of this script mirrored /logo.png into the
  // versioned set, where nothing would ever request it.
  rmSync(resolve(versioned, 'logo.png'), { force: true })

  const width = Math.max(...report.map((row) => row.name.length))
  for (const row of report) {
    console.log(
      `  ${row.name.padEnd(width)}  ${row.size.padStart(9)}  ` +
        `${(row.bytes / 1024).toFixed(1).padStart(7)} KB  →  ${row.written}`,
    )
  }
  const dual = report.filter((row) => !LEGACY_ONLY.has(row.name)).length
  console.log(
    `\n${report.length} files written (${dual} to both public/icons/v2/ and public/); ` +
      'public/favicon.svg removed.',
  )
  console.log('site.webmanifest untouched (hand-maintained; see scripts/check-icons.cjs).')
  console.log('Now re-check the wiring: node scripts/check-icons.cjs')
}

main().catch((error) => {
  console.error(`\nIcon generation failed: ${error.message}\n`)
  process.exit(1)
})
