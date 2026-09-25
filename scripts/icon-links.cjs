/**
 * Single source of truth for the icon links in every HTML head.
 *
 * index.html carries its own copy (it is hand-maintained), the generated story
 * pages import this module, and scripts/check-icons.cjs fails the build if the
 * two ever disagree or if a referenced file is missing.
 *
 * The paths are versioned (`/icons/v2/`) on purpose. Browsers keep favicons in
 * their own stores — Safari's icon database, Chrome's favicon service,
 * Firefox's favicons.sqlite — keyed by icon URL rather than by Cache-Control,
 * so a URL that has never existed cannot be served from a stale entry. Bumping
 * ICON_VERSION is what ships a new mark instantly; the matching artwork also
 * sits at the legacy root paths for probes and old references.
 */
const ICON_VERSION = 'v2'

const MANIFEST_HREF = '/site.webmanifest'

const ICON_LINKS = [
  { rel: 'icon', href: `/icons/${ICON_VERSION}/favicon.ico`, sizes: 'any' },
  { rel: 'icon', type: 'image/png', sizes: '16x16', href: `/icons/${ICON_VERSION}/favicon-16x16.png` },
  { rel: 'icon', type: 'image/png', sizes: '32x32', href: `/icons/${ICON_VERSION}/favicon-32x32.png` },
  { rel: 'icon', type: 'image/png', sizes: '48x48', href: `/icons/${ICON_VERSION}/favicon-48x48.png` },
  { rel: 'icon', type: 'image/png', sizes: '64x64', href: `/icons/${ICON_VERSION}/favicon-64.png` },
  {
    rel: 'apple-touch-icon',
    sizes: '180x180',
    href: `/icons/${ICON_VERSION}/apple-touch-icon.png`,
  },
]

/** Every icon URL the versioned set is expected to publish, in both locations. */
const ICON_FILES = [
  'favicon.ico',
  'favicon-16x16.png',
  'favicon-32x32.png',
  'favicon-48x48.png',
  'favicon-64.png',
  'apple-touch-icon.png',
  'android-chrome-192x192.png',
  'android-chrome-512x512.png',
  'maskable-512x512.png',
]

const linkTag = (link) => {
  const attrs = [`rel="${link.rel}"`]
  if (link.type) attrs.push(`type="${link.type}"`)
  if (link.sizes) attrs.push(`sizes="${link.sizes}"`)
  attrs.push(`href="${link.href}"`)
  return `<link ${attrs.join(' ')} />`
}

const ICON_HEAD_HTML = ICON_LINKS.map(linkTag).join('\n    ')

module.exports = {
  ICON_VERSION,
  ICON_LINKS,
  ICON_FILES,
  MANIFEST_HREF,
  ICON_HEAD_HTML,
  linkTag,
}
