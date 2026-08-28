import { useMemo, useState, useEffect } from 'react'
import { travelStories, storySlug } from '../components/data'

export interface StorySuggestion {
  id: string
  title: string
  subtitle: string
  image: string
  slug: string
}

export function useStorySearchAutocomplete(inputValue: string) {
  const [debounced, setDebounced] = useState('')

  useEffect(() => {
    const t = setTimeout(() => setDebounced(inputValue), 200)
    return () => clearTimeout(t)
  }, [inputValue])

  const suggestions = useMemo<StorySuggestion[]>(() => {
    const q = debounced.trim()
    if (q.length < 2) return []

    const lq = q.toLowerCase()
    const results: StorySuggestion[] = []

    for (const story of travelStories) {
      const match =
        story.title.toLowerCase().includes(lq) ||
        story.author.toLowerCase().includes(lq)
      if (!match) continue
      results.push({
        id: `story-${story.title}`,
        title: story.title,
        subtitle: story.author,
        image: story.image,
        slug: storySlug(story.title),
      })
    }

    results.sort((a, b) => {
      const aTitle = a.title.toLowerCase().startsWith(lq) ? 0 : 1
      const bTitle = b.title.toLowerCase().startsWith(lq) ? 0 : 1
      if (aTitle !== bTitle) return aTitle - bTitle
      return a.title.length - b.title.length
    })

    return results.slice(0, 5)
  }, [debounced])

  return suggestions
}
