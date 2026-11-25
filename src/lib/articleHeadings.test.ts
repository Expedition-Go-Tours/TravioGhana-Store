import { describe, expect, it } from 'vitest'
import { extractArticleHeadings, headingId } from './articleHeadings'

describe('articleHeadings', () => {
  it('builds stable, unique anchor ids from heading text', () => {
    expect(headingId('Jamón ibérico in Jabugo', 0)).toBe('jamon-iberico-in-jabugo-1')
    expect(headingId('Salt in Maldon', 0)).toBe('salt-in-maldon-1')
    expect(headingId('Salt in Maldon', 1)).toBe('salt-in-maldon-2')
    expect(headingId('', 4)).toBe('section-5')
  })

  it('extracts H2s from TipTap JSON in render order, skipping empty headings', () => {
    expect(
      extractArticleHeadings({
        type: 'doc',
        content: [
          { type: 'paragraph', content: [{ type: 'text', text: 'Intro' }] },
          {
            type: 'heading',
            attrs: { level: 2 },
            content: [{ type: 'text', text: 'First stop' }],
          },
          { type: 'heading', attrs: { level: 2 }, content: [] },
          {
            type: 'heading',
            attrs: { level: 2 },
            content: [{ type: 'text', text: 'First stop' }],
          },
        ],
      }),
    ).toEqual([
      { id: 'first-stop-1', text: 'First stop' },
      { id: 'first-stop-3', text: 'First stop' },
    ])
  })

  it('extracts Portable Text h2 blocks and ignores other shapes', () => {
    const value = [
      { _type: 'block', style: 'h2', children: [{ _type: 'span', text: 'Sea salt' }] },
      { _type: 'block', style: 'normal', children: [{ _type: 'span', text: 'Body' }] },
      { _type: 'block', style: 'h3', children: [{ _type: 'span', text: 'Small' }] },
    ]
    expect(extractArticleHeadings(value)).toEqual([{ id: 'sea-salt-1', text: 'Sea salt' }])
    expect(extractArticleHeadings('One\n\nTwo')).toEqual([])
  })
})
