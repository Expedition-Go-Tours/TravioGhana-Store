#!/usr/bin/env node
/**
 * Renders every travel story to static HTML at public/stories/<slug>.html, plus
 * a linked index at public/stories/index.html.
 *
 * Stories live in the client bundle, so the backend prerenderer has no way to
 * read them — before this, a crawler asking for a story detail page was
 * answered404/noindex. middleware.ts now routes crawler requests for
 * /stories and /stories/<slug> straight to the files here, while browsers
 * still get the React app. The index matters as much as the pages: the
 * crawler-facing /stories used to be a hub that linked to none of its own
 * stories, leaving them reachable only through the sitemap.
 *
 * Reads src/components/travelStories.json — the same file the app renders from
 * — so the sitemap, the crawler copy and the page can never disagree.
 *
 * Run automatically via `npm run prebuild`.
 */

const fs = require('node:fs')
const path = require('node:path')
const { ICON_HEAD_HTML, MANIFEST_HREF } = require('./icon-links.cjs')

const ROOT = path.resolve(__dirname, '..')
const SOURCE = path.join(ROOT, 'src', 'components', 'travelStories.json')
const OUT_DIR = path.join(ROOT, 'public', 'stories')
const SITE_URL = (process.env.SITE_URL || 'https://www.travioghana.com').replace(/\/+$/, '')
const SITE_NAME = 'Travio Ghana'
const YEAR = new Date().getFullYear()

const escapeHtml = (value) => String(value ?? '')
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;')

/** 1200x630 social card — the source photos are 600px-wide thumbnails. */
const ogImage = (url) => {
  const [base] = String(url).split('?')
  return `${base}?w=1200&h=630&fit=crop&q=80`
}

const description = (story) =>
  `${story.title} - ${story.content.category} travel story from Ghana. Discover authentic experiences, local insights, and travel tips for your Ghana adventure.`

const keywords = (story) =>
  `${story.title}, Ghana travel story, ${story.content.category.toLowerCase()} Ghana, Ghana travel guide, things to do in Ghana, Ghana experiences`

const storyUrl = (story) => `${SITE_URL}/stories/${story.slug}`

const NAV_LINKS = [
  ['/', 'Home'],
  ['/tours', 'Tours'],
  ['/stories', 'Travel Stories'],
  ['/about-us', 'About Us'],
  ['/contact-us', 'Contact'],
]

const FOOTER_LINKS = [
  ['/faq', 'FAQ'],
  ['/help-centre', 'Help Centre'],
  ['/reviews', 'Reviews'],
  ['/partnerships', 'Partnerships'],
  ['/privacy-policy', 'Privacy Policy'],
  ['/terms-and-conditions', 'Terms & Conditions'],
]

function renderStory(story, siblings) {
  const image = ogImage(story.image)
  const url = storyUrl(story)
  const published = story.dateISO || story.date

  const articleSchema = {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: story.title,
    description: `${story.title} - ${story.content.category} travel story from Ghana.`,
    image: image,
    url,
    datePublished: published,
    dateModified: published,
    author: { '@type': 'Person', name: story.author || SITE_NAME },
    publisher: {
      '@type': 'Organization',
      name: SITE_NAME,
      url: SITE_URL,
      logo: { '@type': 'ImageObject', url: `${SITE_URL}/logo.png`, width: 512, height: 512 },
    },
    mainEntityOfPage: url,
  }

  const breadcrumbSchema = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Home', item: `${SITE_URL}/` },
      { '@type': 'ListItem', position: 2, name: 'Stories', item: `${SITE_URL}/stories` },
      { '@type': 'ListItem', position: 3, name: story.title, item: url },
    ],
  }

  const meta = [
    story.author,
    story.date,
    `${story.readTime || 5} min read`,
    story.content.category,
  ].filter(Boolean).map(escapeHtml).join(' &middot; ')

  const relatedHtml = siblings.map((s) => `
        <li><a href="/stories/${encodeURIComponent(s.slug)}">${escapeHtml(s.title)}</a> — ${escapeHtml(s.excerpt)}</li>`).join('')

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    ${ICON_HEAD_HTML}
    <link rel="manifest" href="${MANIFEST_HREF}" />
    <title>${escapeHtml(story.title)} | ${escapeHtml(SITE_NAME)}</title>
    <meta name="description" content="${escapeHtml(description(story))}" />
    <meta name="keywords" content="${escapeHtml(keywords(story))}" />
    <link rel="canonical" href="${escapeHtml(url)}" />
    <meta name="robots" content="index, follow" />
    <meta property="og:type" content="article" />
    <meta property="og:title" content="${escapeHtml(story.title)}" />
    <meta property="og:description" content="${escapeHtml(description(story))}" />
    <meta property="og:image" content="${escapeHtml(image)}" />
    <meta property="og:image:width" content="1200" />
    <meta property="og:image:height" content="630" />
    <meta property="og:url" content="${escapeHtml(url)}" />
    <meta property="og:site_name" content="${escapeHtml(SITE_NAME)}" />
    <meta property="og:locale" content="en_US" />
    <meta property="article:published_time" content="${escapeHtml(published)}" />
    <meta property="article:modified_time" content="${escapeHtml(published)}" />
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:title" content="${escapeHtml(story.title)}" />
    <meta name="twitter:description" content="${escapeHtml(description(story))}" />
    <meta name="twitter:image" content="${escapeHtml(image)}" />
    <link rel="alternate" hrefLang="x-default" href="${escapeHtml(url)}" />
    <link rel="alternate" hrefLang="en" href="${escapeHtml(url)}" />
    <script type="application/ld+json">${JSON.stringify(articleSchema)}</script>
    <script type="application/ld+json">${JSON.stringify(breadcrumbSchema)}</script>
    <style>
      body { margin: 0; font: 17px/1.65 -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #101828; background: #fff; }
      .wrap { max-width: 760px; margin: 0 auto; padding: 0 24px 64px; }
      header { background: #065f46; color: #fff; padding: 20px 0; }
      header .wrap { display: flex; gap: 20px; align-items: center; flex-wrap: wrap; padding-bottom: 0; }
      header a { color: #fff; text-decoration: none; font-weight: 600; }
      .crumbs { color: #6b7280; font-size: 14px; margin: 24px 0 8px; }
      .crumbs a { color: #16a34a; text-decoration: none; }
      h1 { font-size: 40px; line-height: 1.15; margin: 8px 0 12px; }
      .meta { color: #6b7280; font-size: 15px; margin-bottom: 24px; }
      .hero { width: 100%; height: auto; border-radius: 14px; margin-bottom: 24px; }
      h2 { font-size: 24px; margin: 36px 0 10px; }
      blockquote { margin: 32px 0; padding: 18px 24px; border-left: 4px solid #d4af37; background: #f9fafb; font-style: italic; }
      ul { padding-left: 22px; }
      li { margin: 6px 0; }
      .related { margin-top: 44px; border-top: 1px solid #e5e7eb; padding-top: 20px; }
      footer { background: #f3f4f6; padding: 28px 0; color: #6b7280; font-size: 14px; }
      footer a { color: #374151; text-decoration: none; margin-right: 16px; display: inline-block; }
    </style>
  </head>
  <body>
    <header>
      <nav class="wrap" aria-label="Main">
${NAV_LINKS.map(([href, label]) => `        <a href="${href}">${escapeHtml(label)}</a>`).join('\n')}
      </nav>
    </header>
    <main class="wrap">
      <nav class="crumbs" aria-label="Breadcrumb">
        <a href="/">Home</a> &rsaquo; <a href="/stories">Stories</a> &rsaquo; <span>${escapeHtml(story.title)}</span>
      </nav>
      <article>
        <h1>${escapeHtml(story.title)}</h1>
        <p class="meta">${meta}</p>
        <img class="hero" src="${escapeHtml(story.image)}" alt="${escapeHtml(story.title)}" width="1200" height="800" loading="eager" />
        <p>${escapeHtml(story.excerpt)}</p>
${story.content.sections.map((section) => `        <section>
          <h2>${escapeHtml(section.heading)}</h2>
          <p>${escapeHtml(section.body)}</p>
        </section>`).join('\n')}
        <h2>Highlights</h2>
        <ul>
${story.content.highlights.map((h) => `          <li>${escapeHtml(h)}</li>`).join('\n')}
        </ul>
        <blockquote>${escapeHtml(story.content.quote)}</blockquote>
        <p><a href="/stories">More travel stories from ${escapeHtml(SITE_NAME)}</a> &middot; <a href="/tours">Browse all Ghana tours</a></p>
        <section class="related" aria-label="Related stories">
          <h2>Keep reading</h2>
          <ul>
${relatedHtml}
          </ul>
        </section>
      </article>
    </main>
    <footer>
      <nav class="wrap" aria-label="Footer">
${FOOTER_LINKS.map(([href, label]) => `        <a href="${href}">${escapeHtml(label)}</a>`).join('\n')}
      </nav>
      <p class="wrap">&copy; ${YEAR} ${escapeHtml(SITE_NAME)}. All rights reserved.</p>
    </footer>
  </body>
</html>
`
}

/**
 * The crawler-facing /stories hub: the same copy the backend prerenderer
 * serves, but with a link to every story (which it cannot render — the data
 * only exists in the client bundle).
 */
function renderIndex(stories) {
  const url = `${SITE_URL}/stories`
  const title = 'Travel Stories from Ghana'
  const description =
    'Read inspiring travel stories from Ghana. Discover hidden gems, local culture, food, and adventure experiences.'
  const keywords = 'Ghana travel stories, Ghana blog, travel experiences Ghana'
  const image = `${SITE_URL}/og-default.png`

  const breadcrumbSchema = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Home', item: `${SITE_URL}/` },
      { '@type': 'ListItem', position: 2, name: 'Stories', item: url },
    ],
  }

  const itemListSchema = {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    numberOfItems: stories.length,
    itemListElement: stories.map((story, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: story.title,
      url: storyUrl(story),
    })),
  }

  const cards = stories.map((story) => `
      <li class="card">
        <a class="card-link" href="/stories/${encodeURIComponent(story.slug)}">
          <img src="${escapeHtml(story.image)}" alt="${escapeHtml(story.title)}" width="600" height="400" loading="lazy" />
          <h2>${escapeHtml(story.title)}</h2>
        </a>
        <p class="meta">${escapeHtml(story.content.category)} &middot; ${escapeHtml(story.date || '')}</p>
        <p>${escapeHtml(story.excerpt)}</p>
        <p><a href="/stories/${encodeURIComponent(story.slug)}">Read ${escapeHtml(story.title)}</a></p>
      </li>`).join('')

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    ${ICON_HEAD_HTML}
    <link rel="manifest" href="${MANIFEST_HREF}" />
    <title>${escapeHtml(title)} | ${escapeHtml(SITE_NAME)}</title>
    <meta name="description" content="${escapeHtml(description)}" />
    <meta name="keywords" content="${escapeHtml(keywords)}" />
    <link rel="canonical" href="${escapeHtml(url)}" />
    <meta name="robots" content="index, follow" />
    <meta property="og:type" content="website" />
    <meta property="og:title" content="${escapeHtml(title)}" />
    <meta property="og:description" content="${escapeHtml(description)}" />
    <meta property="og:image" content="${escapeHtml(image)}" />
    <meta property="og:image:width" content="1200" />
    <meta property="og:image:height" content="630" />
    <meta property="og:url" content="${escapeHtml(url)}" />
    <meta property="og:site_name" content="${escapeHtml(SITE_NAME)}" />
    <meta property="og:locale" content="en_US" />
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:title" content="${escapeHtml(title)}" />
    <meta name="twitter:description" content="${escapeHtml(description)}" />
    <meta name="twitter:image" content="${escapeHtml(image)}" />
    <script type="application/ld+json">${JSON.stringify(breadcrumbSchema)}</script>
    <script type="application/ld+json">${JSON.stringify(itemListSchema)}</script>
    <style>
      body { margin: 0; font: 17px/1.65 -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #101828; background: #fff; }
      .wrap { max-width: 960px; margin: 0 auto; padding: 0 24px 64px; }
      header { background: #065f46; color: #fff; padding: 20px 0; }
      header .wrap { display: flex; gap: 20px; align-items: center; flex-wrap: wrap; padding-bottom: 0; }
      header a { color: #fff; text-decoration: none; font-weight: 600; }
      .crumbs { color: #6b7280; font-size: 14px; margin: 24px 0 8px; }
      .crumbs a { color: #16a34a; text-decoration: none; }
      h1 { font-size: 40px; line-height: 1.15; margin: 8px 0 12px; }
      .intro { color: #4b5563; max-width: 640px; }
      ul.cards { list-style: none; padding: 0; margin: 32px 0 0; display: grid; gap: 32px; grid-template-columns: repeat(auto-fit, minmax(260px, 1fr)); }
      .card img { width: 100%; height: auto; border-radius: 14px; display: block; margin-bottom: 12px; }
      .card h2 { font-size: 21px; line-height: 1.3; margin: 0 0 6px; }
      .card a { color: #065f46; text-decoration: none; }
      .card a:hover { text-decoration: underline; }
      .card .meta { color: #6b7280; font-size: 14px; margin: 0 0 8px; }
      .card p { margin: 0 0 8px; }
      footer { background: #f3f4f6; padding: 28px 0; color: #6b7280; font-size: 14px; }
      footer a { color: #374151; text-decoration: none; margin-right: 16px; display: inline-block; }
    </style>
  </head>
  <body>
    <header>
      <nav class="wrap" aria-label="Main">
${NAV_LINKS.map(([href, label]) => `        <a href="${href}">${escapeHtml(label)}</a>`).join('\n')}
      </nav>
    </header>
    <main class="wrap">
      <nav class="crumbs" aria-label="Breadcrumb">
        <a href="/">Home</a> &rsaquo; <span>Stories</span>
      </nav>
      <h1>${escapeHtml(title)}</h1>
      <p class="intro">${escapeHtml(description)}</p>
      <ul class="cards">
${cards}
      </ul>
      <p><a href="/tours">Browse all Ghana tours</a></p>
    </main>
    <footer>
      <nav class="wrap" aria-label="Footer">
${FOOTER_LINKS.map(([href, label]) => `        <a href="${href}">${escapeHtml(label)}</a>`).join('\n')}
      </nav>
      <p class="wrap">&copy; ${YEAR} ${escapeHtml(SITE_NAME)}. All rights reserved.</p>
    </footer>
  </body>
</html>
`
}

function main() {
  const stories = JSON.parse(fs.readFileSync(SOURCE, 'utf8'))
  if (!Array.isArray(stories) || stories.length === 0) {
    throw new Error('travelStories.json is empty — refusing to write an empty story directory')
  }

  fs.mkdirSync(OUT_DIR, { recursive: true })
  // Drop pages for stories that no longer exist so the directory is exactly
  // what the current data promises.
  for (const file of fs.readdirSync(OUT_DIR)) {
    if (file.endsWith('.html')) fs.unlinkSync(path.join(OUT_DIR, file))
  }

  for (const story of stories) {
    if (!story.slug) throw new Error(`story without a slug: ${story.title}`)
    const related = stories.filter((s) => s.slug !== story.slug).slice(0, 3)
    fs.writeFileSync(path.join(OUT_DIR, `${story.slug}.html`), renderStory(story, related))
  }

  // The hub itself, so /stories links to everything it is supposed to surface.
  fs.writeFileSync(path.join(OUT_DIR, 'index.html'), renderIndex(stories))

  console.log(`story pages: wrote ${stories.length} pages + index to public/stories/`)
}

main()
