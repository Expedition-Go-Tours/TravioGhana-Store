import { useState } from 'react'
import { Share2, Link2, Check } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { createWishlistShare } from '../lib/storefrontExtras'
import './WishlistShareButton.css'

/**
 * Share a saved list with the people you travel with.
 *
 * The link is minted server-side (opaque token, revocable) and opened through
 * `navigator.share` on phones — in Ghana the destination is almost always a
 * WhatsApp group, so the native sheet beats a clipboard round-trip whenever
 * the browser offers it. Clipboard is the fallback everywhere else.
 */
export default function WishlistShareButton({ disabled = false }: { disabled?: boolean }) {
  const { t } = useTranslation()
  const [state, setState] = useState<'idle' | 'loading' | 'copied'>('idle')

  async function handleShare() {
    if (state === 'loading') return
    setState('loading')
    try {
      const share = await createWishlistShare()
      const text = t('wishlist.shareText', 'Tours I want to do in Ghana — take a look')

      if (typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
        try {
          await navigator.share({ title: t('wishlist.shareTitle', 'My Travio Ghana wishlist'), text, url: share.url })
          setState('idle')
          return
        } catch {
          // Dismissed the sheet (or sharing is blocked) — fall through to copy.
        }
      }

      await navigator.clipboard.writeText(share.url)
      setState('copied')
      toast.success(t('wishlist.linkCopied', 'Link copied — paste it into your chat'))
      window.setTimeout(() => setState('idle'), 2500)
    } catch (err) {
      setState('idle')
      const message = err instanceof Error && err.message ? err.message : t('wishlist.shareFailed', 'Could not create a share link. Try again.')
      toast.error(message)
    }
  }

  return (
    <button type="button" className="wishlist-share-btn" onClick={handleShare} disabled={disabled || state === 'loading'}>
      {state === 'copied' ? <Check size={15} aria-hidden="true" /> : state === 'loading' ? <Link2 size={15} aria-hidden="true" /> : <Share2 size={15} aria-hidden="true" />}
      <span>
        {state === 'copied'
          ? t('wishlist.copied', 'Copied')
          : t('wishlist.share', 'Share list')}
      </span>
    </button>
  )
}
