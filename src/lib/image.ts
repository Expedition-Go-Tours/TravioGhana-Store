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
