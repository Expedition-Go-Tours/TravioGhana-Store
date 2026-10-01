interface TransformOpts {
  crop?: string
  fit?: 'crop' | 'fill' | 'scale'
  gravity?: 'auto' | 'face' | 'center' | 'north' | 'south' | 'east' | 'west'
  width?: number
  height?: number
  quality?: string
  format?: string
}

export function optimizeImage(urlOrObj: string | { url?: string } | null | undefined): string | null {
  return transformImage(urlOrObj)
}

export function transformImage(
  urlOrObj: string | { url?: string } | null | undefined,
  opts: TransformOpts = {},
): string | null {
  const url = typeof urlOrObj === 'string' ? urlOrObj : urlOrObj?.url ?? urlOrObj
  if (!url || typeof url !== 'string') return null

  if (url.includes('googleusercontent.com') || url.includes('googleapis.com')) return url

  if (url.includes('res.cloudinary.com')) {
    const marker = '/upload/'
    const idx = url.indexOf(marker)
    if (idx === -1) return url

    const base = url.slice(0, idx + marker.length)
    const after = url.slice(idx + marker.length)

    const parts = after.split('/')
    let version = ''
    let path: string[] = []
    for (let i = 0; i < parts.length; i++) {
      const seg = parts[i]
      if (/^v\d+$/i.test(seg)) {
        version = seg + '/'
        path = parts.slice(i + 1)
        break
      }
      if (!seg.includes('_')) {
        path = parts.slice(i)
        break
      }
    }

    const transforms: string[] = []
    const crop = opts.crop ?? opts.fit
    if (crop) transforms.push(`c_${crop}`)
    if (opts.gravity) transforms.push(`g_${opts.gravity}`)
    if (opts.width) transforms.push(`w_${opts.width}`)
    if (opts.height) transforms.push(`h_${opts.height}`)
    if (opts.quality) transforms.push(`q_${opts.quality}`)
    if (opts.format) transforms.push(`f_${opts.format}`)

    if (transforms.length === 0) {
      transforms.push('q_auto', 'f_auto')
    }

    const pathStr = path.join('/')
    return `${base}${transforms.join(',')}/${version}${pathStr}`
  }

  return url
}

/**
 * Params the full-screen viewer requests. Exported so the gallery can warm the
 * exact same URLs (`prefetchLightboxImages`) and the first "next" click paints
 * straight from the HTTP cache.
 */
export const LIGHTBOX_IMAGE = {
  width: 1200,
  crop: 'limit',
  sizes: '100vw',
} as const

/** The `src`/`srcSet` the viewer will use for one photo — no crop, no upscale. */
export function lightboxImageUrls(
  src: string | null | undefined,
): { src: string; srcSet: string } | null {
  if (!src || typeof src !== 'string') return null
  const opts: TransformOpts = {
    width: LIGHTBOX_IMAGE.width * 2,
    crop: LIGHTBOX_IMAGE.crop,
    quality: 'auto:good',
    format: 'auto',
  }
  const primary = transformImage(src, opts)
  if (!primary) return null
  return {
    src: primary,
    srcSet: getSrcSet(src, [LIGHTBOX_IMAGE.width, LIGHTBOX_IMAGE.width * 2], opts),
  }
}

export function getSrcSet(url: string, widths: number[], opts: TransformOpts = {}): string {
  if (!url || !widths || widths.length === 0) return ''
  // Keep the requested aspect ratio at EVERY breakpoint. Callers pass the 1x
  // box (width + height); spreading opts verbatim would reuse the 1x height on
  // the 2x candidate (e.g. w_1200,h_1500 next to w_2400,h_1500), so the browser
  // would choose between two differently-cropped images.
  const ratio = opts.width && opts.height ? opts.height / opts.width : null
  return widths
    .map((w) => {
      const height = ratio ? Math.round(w * ratio) : opts.height
      const img = transformImage(url, { ...opts, width: w, ...(height ? { height } : {}) })
      return `${img} ${w}w`
    })
    .join(', ')
}

/**
 * Widths Vercel's Image Optimization is allowed to emit — `vercel.json →
 * images.sizes`. A width missing from that array makes `/_vercel/image` answer
 * with an error rather than an image, so the two lists must stay in step.
 *
 * 320 exists for the small boxes — a 38px thumbnail, a 180px gallery cell —
 * which otherwise had to fetch 640. The two rungs above it are what make it
 * safe to offer: see MIN_SOURCE_WIDTH.
 */
export const OPTIMIZED_WIDTHS = [320, 640, 1080, 1600] as const

/**
 * Narrowest source worth optimizing, independent of OPTIMIZED_WIDTHS.
 *
 * Below this the source is already close to the largest size any breakpoint
 * will ask for, so 320 would be the ONLY candidate — and on a 2x screen the
 * browser must pick it even where it needs ~580px, which is softer than simply
 * serving the original. Keeping sources under 640 out of the pipeline leaves
 * them on `src`, sharp at every DPR, at the cost of a few KB at 1x.
 */
export const MIN_SOURCE_WIDTH = 640

/** Matches `vercel.json → images.qualities`. */
export const OPTIMIZED_QUALITY = 75

/**
 * Default `sizes` for an image that fills its column: full-bleed on phones,
 * half width on tablets, a third on wide desktops (mirrors the 768px `md`
 * breakpoint). Callers whose layout differs should pass their own.
 */
export const DEFAULT_IMAGE_SIZES = '(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw'

/**
 * `srcSet` for a BUNDLED asset — a Vite-hashed file under `/assets/`, e.g.
 * `/assets/hero-2-b6UGMurk.webp`.
 *
 * Vite emits these at their intrinsic pixel size, so a 390px phone downloads
 * the whole 1350×900 original (measured: 214 KB, 58 KB at 640w). Routing them
 * through Vercel's Image Optimization lets the browser pick a width, and the
 * AVIF/WebP output cuts a further ~25% off the WebP source.
 *
 * `src` should stay the UNOPTIMIZED asset: it is the value that always works,
 * so anything that opts out of srcset (or a build where the `images` config is
 * absent) still renders.
 *
 * `intrinsicWidth` is the source file's own pixel width — pass the same number
 * as the element's `width` attribute. It does two jobs:
 *  1. Candidates are capped at the source width. `/_vercel/image` will happily
 *     hand back a 1600w transform of a 720w file, which is the original with
 *     extra bytes and no extra detail; never offer a width the source can't
 *     fill.
 *  2. Anything narrower than MIN_SOURCE_WIDTH gets no `srcSet` at all: 320
 *     would be its only rung, and a 2x browser forced to pick it renders
 *     softer than the original it already had. Vercel also advises against
 *     spending transformation quota on small images.
 *
 * Returns null when the URL isn't optimizable, so callers fall back cleanly:
 *  - `enabled` false — the `vite dev`/`vite preview` servers have no
 *    `/_vercel/image`, so those builds must ship the original `src`;
 *  - not under `/assets/` (remote hosts have their own transform, e.g.
 *    Cloudinary, and are allow-listed separately);
 *  - `.svg` — Vercel refuses to optimize SVG unless `dangerouslyAllowSVG` is
 *    set, so requesting one returns an error instead of an image;
 *  - unknown intrinsic width (don't guess — a wrong `srcSet` is worse than none).
 */
export function optimizedLocalSrcSet(
  url: string | null | undefined,
  intrinsicWidth?: number | string | null,
  enabled = true,
): string | null {
  // `/_vercel/image` is served by Vercel's platform, not by `vite dev` or
  // `vite preview`. A srcset candidate that resolves to the SPA shell isn't a
  // slightly smaller image, it's a broken one — browsers do not fall back to
  // `src` once a srcset candidate is selected. Callers pass
  // `import.meta.env.PROD` so local development renders the original file.
  if (!enabled) return null
  if (!url || typeof url !== 'string') return null
  if (!url.startsWith('/assets/')) return null
  if (/\.svg(\?|#|$)/i.test(url)) return null

  const px = typeof intrinsicWidth === 'string' ? parseInt(intrinsicWidth, 10) : intrinsicWidth
  if (!px || !Number.isFinite(px) || px <= 0) return null
  // Not the narrowest CONFIGURED width — the narrowest width that still leaves
  // the browser a larger rung to reach for on a 2x screen.
  if (px < MIN_SOURCE_WIDTH) return null

  const widths = OPTIMIZED_WIDTHS.filter((w) => w <= px)
  if (widths.length === 0) return null

  const encoded = encodeURIComponent(url)
  return widths
    .map((w) => `/_vercel/image?url=${encoded}&w=${w}&q=${OPTIMIZED_QUALITY} ${w}w`)
    .join(', ')
}

