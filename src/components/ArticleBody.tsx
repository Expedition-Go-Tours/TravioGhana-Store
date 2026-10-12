import { Fragment, type ReactNode } from 'react'

/**
 * Renders an article `body` in whichever shape the backend hands it over.
 *
 * The column holds three producers, all feeding the same `Article.body Json`:
 *  - TipTap JSON `{ type: 'doc', ... }` — what the admin's rich-text editor saves
 *  - Portable Text `[{ _type: 'block', ... }]` — the Sanity import path and the seeds
 *  - a plain string — legacy/manual rows
 *
 * Anything unrecognised renders nothing rather than dumping `[object Object]`
 * into the page; the excerpt lead above the body still carries the article.
 */

/** TipTap JSON (what the admin's editor saves). */
interface TipTapAttrs {
  level?: number
  src?: string
  alt?: string
  title?: string
  href?: string
}

interface TipTapMark {
  type: string
  attrs?: TipTapAttrs
}

interface TipTapNode {
  type?: string
  content?: TipTapNode[]
  text?: string
  marks?: TipTapMark[]
  attrs?: TipTapAttrs
}

/** Portable Text (Sanity / the seeded articles). */
interface PortableSpan {
  _type?: string
  _key?: string
  text?: string
  marks?: (string | Record<string, unknown>)[]
}

interface PortableMarkDef {
  _key: string
  _type: string
  href?: string
  title?: string
}

interface PortableBlock {
  _type?: string
  _key?: string
  style?: string
  listItem?: string
  level?: number
  children?: PortableSpan[]
  markDefs?: PortableMarkDef[]
  url?: string
  alt?: string
}

const HEADING_TAGS = ['h1', 'h2', 'h3', 'h4', 'h5', 'h6'] as const

function applyTipTapMarks(text: string, marks?: TipTapMark[]): ReactNode {
  if (!marks?.length) return text
  return marks.reduce<ReactNode>((node, mark) => {
    switch (mark.type) {
      case 'bold':
        return <strong>{node}</strong>
      case 'italic':
        return <em>{node}</em>
      case 'underline':
        return <u>{node}</u>
      case 'strike':
        return <s>{node}</s>
      case 'code':
        return <code>{node}</code>
      case 'link':
        return mark.attrs?.href ? (
          <a href={mark.attrs.href} target="_blank" rel="noopener noreferrer">
            {node}
          </a>
        ) : (
          node
        )
      default:
        return node
    }
  }, text)
}

function renderTipTap(node: TipTapNode, key: string): ReactNode {
  const children = node.content?.map((child, i) => renderTipTap(child, `${key}.${i}`))

  switch (node.type) {
    case 'paragraph':
      return <p key={key}>{children}</p>
    case 'heading': {
      const level = node.attrs?.level ?? 2
      const Tag = HEADING_TAGS[Math.min(Math.max(level, 1), HEADING_TAGS.length) - 1]
      return <Tag key={key}>{children}</Tag>
    }
    case 'bulletList':
      return <ul key={key}>{children}</ul>
    case 'orderedList':
      return <ol key={key}>{children}</ol>
    case 'listItem':
      return <li key={key}>{children}</li>
    case 'blockquote':
      return <blockquote key={key}>{children}</blockquote>
    case 'codeBlock':
      return (
        <pre key={key}>
          <code>{children}</code>
        </pre>
      )
    case 'horizontalRule':
      return <hr key={key} />
    case 'hardBreak':
      return <br key={key} />
    case 'image':
      return node.attrs?.src ? (
        <figure key={key} className="article-body__figure">
          <img src={node.attrs.src} alt={node.attrs.alt || ''} loading="lazy" />
        </figure>
      ) : null
    case 'text':
      // Keyed wrapper: marked text comes back as an element, and elements
      // inside the parent's children array need their own key.
      return <Fragment key={key}>{applyTipTapMarks(node.text ?? '', node.marks)}</Fragment>
    default:
      // Unknown node (extension we don't model) — keep its children so the
      // surrounding copy still flows instead of punching a hole in the prose.
      return children ? <Fragment key={key}>{children}</Fragment> : null
  }
}

function applyPortableMarks(
  text: string,
  marks: PortableSpan['marks'],
  markDefs: PortableMarkDef[],
): ReactNode {
  if (!marks?.length) return text
  return marks.reduce<ReactNode>((node, mark) => {
    if (mark && typeof mark === 'object') {
      // Some producers inline the definition instead of referencing a key.
      if (mark._type === 'link' && typeof mark.href === 'string') {
        return (
          <a href={mark.href} target="_blank" rel="noopener noreferrer">
            {node}
          </a>
        )
      }
      return node
    }
    switch (mark) {
      case 'strong':
        return <strong>{node}</strong>
      case 'em':
        return <em>{node}</em>
      case 'underline':
        return <u>{node}</u>
      case 'strike':
        return <s>{node}</s>
      case 'code':
        return <code>{node}</code>
      default: {
        const def = markDefs.find((d) => d._key === mark)
        if (def?._type === 'link' && def.href) {
          return (
            <a href={def.href} target="_blank" rel="noopener noreferrer">
              {node}
            </a>
          )
        }
        return node
      }
    }
  }, text)
}

function portableBlockContent(block: PortableBlock): ReactNode {
  const markDefs = block.markDefs ?? []
  return block.children?.map((span, i) => (
    <Fragment key={span._key ?? `s${i}`}>
      {span._type && span._type !== 'span'
        ? (span.text ?? null)
        : applyPortableMarks(span.text ?? '', span.marks, markDefs)}
    </Fragment>
  ))
}

function renderPortableText(blocks: PortableBlock[]): ReactNode[] {
  const out: ReactNode[] = []
  let i = 0

  while (i < blocks.length) {
    const block = blocks[i]
    const key = block._key ?? `b${i}`

    if (block._type === 'image') {
      if (block.url) {
        out.push(
          <figure key={key} className="article-body__figure">
            <img src={block.url} alt={block.alt || ''} loading="lazy" />
          </figure>,
        )
      }
      i += 1
      continue
    }

    // Consecutive list blocks of the same type become one list.
    if (block.listItem) {
      const ordered = block.listItem === 'number'
      const items: ReactNode[] = []
      while (i < blocks.length && blocks[i].listItem === block.listItem) {
        const item = blocks[i]
        items.push(<li key={item._key ?? `b${i}`}>{portableBlockContent(item)}</li>)
        i += 1
      }
      out.push(ordered ? <ol key={key}>{items}</ol> : <ul key={key}>{items}</ul>)
      continue
    }

    const style = block.style ?? 'normal'
    const heading = /^h([1-6])$/.exec(style)
    if (heading) {
      const Tag = HEADING_TAGS[Number(heading[1]) - 1]
      out.push(<Tag key={key}>{portableBlockContent(block)}</Tag>)
    } else if (style === 'blockquote') {
      out.push(<blockquote key={key}>{portableBlockContent(block)}</blockquote>)
    } else {
      out.push(<p key={key}>{portableBlockContent(block)}</p>)
    }
    i += 1
  }

  return out
}

function renderPlainText(text: string): ReactNode[] {
  return text
    .split(/\n{2,}/)
    .filter((paragraph) => paragraph.trim().length > 0)
    .map((paragraph, i) => <p key={`p${i}`}>{paragraph.trim()}</p>)
}

export default function ArticleBody({ value }: { value: unknown }) {
  if (value == null) return null

  if (typeof value === 'string') {
    const nodes = renderPlainText(value)
    return nodes.length ? <>{nodes}</> : null
  }

  if (Array.isArray(value)) {
    const nodes = renderPortableText(value as PortableBlock[])
    return nodes.length ? <>{nodes}</> : null
  }

  if (typeof value === 'object') {
    const node = value as TipTapNode
    if (node.type === 'doc' || Array.isArray(node.content)) {
      const nodes = (node.content ?? []).map((child, i) => renderTipTap(child, `t${i}`))
      return nodes.length ? <>{nodes}</> : null
    }
  }

  return null
}
