import { DEFAULT_IMAGE_SIZES, optimizedLocalSrcSet } from '@/lib/image'

type BundledImageProps = React.ImgHTMLAttributes<HTMLImageElement> &
  // React 19 passes `ref` through as an ordinary prop, so it rides along in
  // `...rest` onto the underlying <img>. Declaring it here keeps callers typed.
  React.RefAttributes<HTMLImageElement> & {
    /** A Vite-bundled asset, e.g. `import hero from '@/assets/about/hero-1.webp'`. */
    src: string
  }

/**
 * `<img>` for assets imported out of `src/assets`, with a responsive `srcSet`
 * generated automatically.
 *
 * Why this exists: the marketing and legal pages import their imagery directly
 * (`import hero1 from '../assets/about/hero-1.webp'`) and render it with a bare
 * `<img>`. Those files are emitted at intrinsic size, so a 390px phone was
 * downloading the full 1350×900 original — measured at 214 KB where a 640w
 * transform is 58 KB. `srcSet`/`sizes` appeared zero times across those pages.
 *
 * The markup is unchanged apart from two attributes: same element, same props,
 * so nothing about layout or loading behaviour moves. `src` stays the
 * unoptimized file, which is the value that always resolves — so if the
 * `images` config is ever absent from `vercel.json`, the browser falls back to
 * the original rather than to a broken URL.
 *
 * **Always pass `width`, `height` and `sizes`.** They do two separate jobs:
 *  - `width`/`height` are the source's intrinsic pixels. They set the aspect
 *    ratio (so the box is reserved before the bytes arrive) and they cap the
 *    `srcSet` candidates, so the optimizer is never asked to upscale.
 *  - `sizes` must describe THIS image's layout width, not the page's. A card
 *    that is 280px wide wants `sizes="280px"`; defaulting to `100vw` would make
 *    the browser pick the largest candidate for a thumbnail.
 *
 * Omit `sizes` only for genuinely full-bleed imagery (hero backgrounds).
 */
export default function BundledImage({
  src,
  srcSet,
  sizes,
  width,
  ...rest
}: BundledImageProps) {
  const responsive = srcSet ?? optimizedLocalSrcSet(src, width, import.meta.env.PROD)

  if (!responsive) {
    // Not optimizable (SVG, a remote host, or too small a source) — exactly <img>.
    return <img src={src} srcSet={srcSet} sizes={sizes} width={width} {...rest} />
  }

  return (
    <img
      src={src}
      srcSet={responsive}
      sizes={sizes ?? DEFAULT_IMAGE_SIZES}
      width={width}
      {...rest}
    />
  )
}
