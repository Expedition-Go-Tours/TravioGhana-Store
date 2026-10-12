import { describe, expect, it } from 'vitest'
import { render } from '@testing-library/react'
import ArticleBody from './ArticleBody'

describe('ArticleBody', () => {
  it('renders TipTap JSON from the admin editor (doc, headings, lists, marks)', () => {
    const { container } = render(
      <ArticleBody
        value={{
          type: 'doc',
          content: [
            { type: 'paragraph', content: [{ type: 'text', text: 'Plain opening line.' }] },
            {
              type: 'paragraph',
              content: [
                { type: 'text', text: 'bold', marks: [{ type: 'bold' }] },
                { type: 'text', text: ' and ' },
                { type: 'text', text: 'linked', marks: [{ type: 'link', attrs: { href: 'https://example.com' } }] },
                { type: 'text', text: '.' },
              ],
            },
            { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: 'Subhead' }] },
            {
              type: 'bulletList',
              content: [
                { type: 'listItem', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'First' }] }] },
                { type: 'listItem', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Second' }] }] },
              ],
            },
            { type: 'horizontalRule' },
          ],
        }}
      />,
    )

    // Two top-level paragraphs plus one inside each list item.
    expect(container.querySelectorAll('p')).toHaveLength(4)
    expect(container.querySelector('p')?.textContent).toBe('Plain opening line.')
    expect(container.querySelector('strong')).toHaveTextContent('bold')
    expect(container.querySelector('a')).toHaveAttribute('href', 'https://example.com')
    expect(container.querySelector('h2')?.textContent).toBe('Subhead')
    expect(container.querySelectorAll('li')).toHaveLength(2)
    expect(container.querySelector('hr')).not.toBeNull()
  })

  it('renders Portable Text (the seed/Sanity shape) with list grouping', () => {
    const { container } = render(
      <ArticleBody
        value={[
          { _type: 'block', style: 'normal', markDefs: [], children: [{ _type: 'span', text: 'Seeded prose.', marks: [] }] },
          {
            _type: 'block',
            style: 'normal',
            markDefs: [{ _key: 'link1', _type: 'link', href: 'https://ghana.example' }],
            children: [{ _type: 'span', text: 'Go there', marks: ['link1'] }],
          },
          { _type: 'block', style: 'h3', markDefs: [], children: [{ _type: 'span', text: 'Seeded head', marks: [] }] },
          { _type: 'block', style: 'normal', listItem: 'bullet', markDefs: [], children: [{ _type: 'span', text: 'Item one', marks: [] }] },
          { _type: 'block', style: 'normal', listItem: 'bullet', markDefs: [], children: [{ _type: 'span', text: 'Item two', marks: [] }] },
        ]}
      />,
    )

    // Two normal blocks (the heading and the list items are not <p>).
    expect(container.querySelectorAll('p')).toHaveLength(2)
    expect(container.querySelectorAll('p')[0]).toHaveTextContent('Seeded prose.')
    expect(container.querySelector('h3')?.textContent).toBe('Seeded head')
    expect(container.querySelectorAll('ul')).toHaveLength(1)
    expect(container.querySelectorAll('li')).toHaveLength(2)
    expect(container.querySelector('a')).toHaveAttribute('href', 'https://ghana.example')
  })

  it('renders a plain string body as paragraphs', () => {
    const { container } = render(<ArticleBody value={'First block.\n\nSecond block.'} />)

    expect(container.querySelectorAll('p')).toHaveLength(2)
    expect(container.querySelectorAll('p')[1].textContent).toBe('Second block.')
  })

  it('renders nothing for empty or unrecognised input (never [object Object])', () => {
    const { container: empty } = render(<ArticleBody value={null} />)
    expect(empty).toBeEmptyDOMElement()

    const { container: unknown } = render(<ArticleBody value={{ some: 'shape' }} />)
    expect(unknown).toBeEmptyDOMElement()
    expect(unknown.textContent).not.toContain('[object Object]')
  })
})
