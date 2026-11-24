/**
 * Anchor IDs for the article table of contents.
 *
 * The TOC and the rendered headings must agree without a second DOM pass that
 * writes React state. Both are derived from the same body value: this extracts
 * the H2s in the order `ArticleBody` renders them, and the page assigns the
 * matching ids to the DOM headings after paint.
 */
export interface ArticleHeading {
  id: string
  text: string
}

export function headingId(text: string, index: number): string {
  const slug = text
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
  return slug ? `${slug}-${index + 1}` : `section-${index + 1}`
}

interface IndexedText {
  text: string
  index: number
}

function nodeText(value: unknown): string {
  if (typeof value === 'string') return value
  if (Array.isArray(value)) return value.map(nodeText).join('')
  if (value && typeof value === 'object') {
    const node = value as { text?: unknown; content?: unknown }
    return [nodeText(node.text), nodeText(node.content)].join('')
  }
  return ''
}

function tipTapHeadings(nodes: unknown[], out: IndexedText[]): void {
  let index = 0
  const walk = (value: unknown) => {
    if (!value || typeof value !== 'object') return
    const node = value as { type?: string; attrs?: { level?: number }; content?: unknown[] }
    if (node.type === 'heading' && node.attrs?.level === 2) {
      out.push({ text: nodeText(node.content).trim(), index })
      index += 1
    }
    if (Array.isArray(node.content)) node.content.forEach(walk)
  }
  nodes.forEach(walk)
}

function portableHeadings(blocks: unknown[], out: IndexedText[]): void {
  let index = 0
  for (const block of blocks) {
    if (!block || typeof block !== 'object') continue
    const value = block as { style?: string; children?: unknown; text?: unknown }
    if (value.style === 'h2') {
      out.push({ text: nodeText(value.children ?? value.text).trim(), index })
      index += 1
    }
  }
}

export function extractArticleHeadings(value: unknown): ArticleHeading[] {
  const found: IndexedText[] = []

  if (Array.isArray(value)) {
    portableHeadings(value, found)
  } else if (value && typeof value === 'object') {
    const node = value as { type?: string; content?: unknown[] }
    if (node.type === 'doc' || Array.isArray(node.content)) {
      tipTapHeadings(node.content ?? [], found)
    }
  }

  return found
    .filter((entry) => entry.text)
    .map((entry) => ({ id: headingId(entry.text, entry.index), text: entry.text }))
}
