/**
 * The pre-launch "travel stories" at /stories/* were placeholder content and
 * are gone — but their URLs shipped in sitemaps, so every one of them now
 * redirects to the closest real guide instead of a dead end. Anything that
 * matches nothing lands on the blog hub.
 */
const STORY_REDIRECTS: Record<string, string> = {
  'exploring-the-canopy-a-guide-to-kakum-national-park': '/blog/kakum-national-park-canopy-walkway',
  'the-history-and-heritage-of-cape-coast-castle': '/blog/cape-coast-and-elmina-castles-guide',
  'wildlife-encounters-mole-national-park-safari': '/blog/mole-national-park-safari-guide',
  'exploring-ashanti-culture-in-kumasi': '/blog/kumasi-ashanti-heritage-guide',
}

export function resolveStoryRedirect(slug: string | undefined | null): string {
  const key = (slug ?? '').replace(/\.html$/, '')
  return STORY_REDIRECTS[key] ?? '/blog'
}
