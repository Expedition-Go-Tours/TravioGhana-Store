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

export function getSrcSet(url: string, widths: number[], opts: TransformOpts = {}): string {
  if (!url || !widths || widths.length === 0) return ''
  return widths
    .map((w) => {
      const img = transformImage(url, { ...opts, width: w })
      return `${img} ${w}w`
    })
    .join(', ')
}
