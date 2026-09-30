import { PRESS_MENTIONS } from '../data/pressMentions'
import './FeaturedIn.css'

/**
 * "Selected coverage" band, rendered from `src/data/pressMentions`.
 *
 * Renders nothing while the list is empty — the /press page ships now and the
 * band appears the moment the first real mention is added. That ordering is
 * deliberate: an empty "featured in" strip is a dead patch, and a fabricated
 * one is worse.
 */
export default function FeaturedIn() {
  if (PRESS_MENTIONS.length === 0) return null

  return (
    <section className="featured-in" aria-label="Selected coverage">
      <h2 className="featured-in-heading">Selected coverage</h2>
      <ul className="featured-in-list">
        {PRESS_MENTIONS.map((mention) => (
          <li key={mention.url} className="featured-in-item">
            <a href={mention.url} target="_blank" rel="noopener noreferrer">
              <span className="featured-in-outlet">{mention.outlet}</span>
              <span className="featured-in-title">{mention.title}</span>
              <time dateTime={mention.date}>{mention.date}</time>
            </a>
          </li>
        ))}
      </ul>
    </section>
  )
}
