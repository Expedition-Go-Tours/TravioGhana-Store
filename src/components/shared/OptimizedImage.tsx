import { useState, useCallback, useRef, useEffect } from 'react'
import { transformImage, getSrcSet } from '@/lib/image'

interface OptimizedImageProps extends Omit<React.ImgHTMLAttributes<HTMLImageElement>, 'src'> {
  src: string | null | undefined
  width?: number
  height?: number
  alt?: string
  loading?: 'lazy' | 'eager'
  className?: string
  style?: React.CSSProperties
  fit?: 'crop' | 'fill' | 'scale'
  /** Mark as above-the-fold / LCP image: loading="eager" + fetchpriority="high". */
  priority?: boolean
}

/**
 * Responsive srcSet widths for a given base width.
 * Multipliers chosen to cover 1x, 1.5x, 2x, and 3x DPR screens while
 * staying within Cloudinary's on-the-fly transform budget.
 */
function buildBreakpoints(width: number): number[] {
  return [width, Math.round(width * 1.5), width * 2, Math.round(width * 3)]
}

/**
 * Map a CSS pixel width to a viewport-based `sizes` descriptor.
 * Most images in this app render at ~50vw on desktop and 100vw on mobile.
 * The 768px breakpoint mirrors the app's `md` Tailwind breakpoint.
 */
function widthToSizes(width: number): string {
  if (width <= 400) return '(max-width: 768px) 100vw, 50vw'
  if (width <= 800) return '(max-width: 768px) 100vw, 50vw'
  return '(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw'
}

export default function OptimizedImage({
  src,
  width,
  height,
  alt = '',
  loading = 'lazy',
  className = '',
  style,
  fit,
  priority = false,
  onLoad,
  onError,
  ...imgProps
}: OptimizedImageProps) {
  const [loaded, setLoaded] = useState(false)
  const imgRef = useRef<HTMLImageElement>(null)

  // If the image is already in the browser's in-memory cache (e.g. service
  // worker CacheFirst hit), the `load` event fires synchronously during
  // commit — before the `optimized-img-loading` class can be applied.
  // Detect that case and skip the fade-in entirely.
  useEffect(() => {
    if (loaded) return
    const el = imgRef.current
    if (el?.complete && el.naturalWidth > 0) {
      setLoaded(true)
    }
  }, [loaded])

  const handleLoad = useCallback<React.ReactEventHandler<HTMLImageElement>>(
    (e) => {
      setLoaded(true)
      onLoad?.(e)
    },
    [onLoad],
  )

  const handleError = useCallback<React.ReactEventHandler<HTMLImageElement>>(
    (e) => {
      setLoaded(true) // stop the loading state even on error
      onError?.(e)
    },
    [onError],
  )

  const effectiveLoading = priority ? 'eager' : loading
  const fetchPriority = priority ? 'high' : undefined

  // --- Non-optimized paths (non-Cloudinary, non-Google) ---
  if (!src || (!src.includes('cloudinary') && !src.includes('googleusercontent'))) {
    return (
      <img
        ref={imgRef}
        src={src ?? undefined}
        alt={alt}
        width={width}
        height={height}
        loading={effectiveLoading}
        decoding="async"
        fetchPriority={fetchPriority}
        className={`optimized-img${loaded ? '' : ' optimized-img-loading'} ${className}`}
        style={style}
        onLoad={handleLoad}
        onError={handleError}
        {...imgProps}
      />
    )
  }

  if (src.includes('googleusercontent')) {
    return (
      <img
        ref={imgRef}
        src={src}
        alt={alt}
        width={width}
        height={height}
        loading={effectiveLoading}
        decoding="async"
        fetchPriority={fetchPriority}
        className={`optimized-img${loaded ? '' : ' optimized-img-loading'} ${className}`}
        style={style}
        onLoad={handleLoad}
        onError={handleError}
        {...imgProps}
      />
    )
  }

  // --- Cloudinary-optimized path ---
  const transformOpts = {
    width: width ? width * 2 : undefined,
    height: height ? height * 2 : undefined,
    quality: 'auto:good' as const,
    format: 'auto' as const,
    ...(width && fit ? { fit } : {}),
  }

  const srcSetWidths = width ? buildBreakpoints(width) : undefined
  const transformed = transformImage(src, transformOpts)
  const srcSet = srcSetWidths ? getSrcSet(src, srcSetWidths, transformOpts) : undefined
  const sizes = width ? widthToSizes(width) : undefined

  // LQIP: tiny blurred placeholder shown while full image loads
  const lqipUrl = transformImage(src, { width: 20, quality: 'auto:low', format: 'auto' })
  const placeholderStyle: React.CSSProperties = loaded
    ? { ...style }
    : {
        ...style,
        backgroundImage: lqipUrl ? `url(${lqipUrl})` : undefined,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        filter: 'blur(20px)',
        transform: 'scale(1.1)',
      }

  return (
    <img
      ref={imgRef}
      src={transformed ?? undefined}
      srcSet={srcSet}
      sizes={sizes}
      alt={alt}
      width={width}
      height={height}
      loading={effectiveLoading}
      decoding="async"
      fetchPriority={fetchPriority}
      className={`optimized-img${loaded ? '' : ' optimized-img-loading'} ${className}`}
      style={placeholderStyle}
      onLoad={handleLoad}
      onError={handleError}
      {...imgProps}
    />
  )
}
