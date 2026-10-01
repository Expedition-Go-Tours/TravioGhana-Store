# Backlinks Playbook — travioghana.com

Working playbook for earning links to `travioghana.com`. The goal is not "links";
it is **referring domains from real, relevant sites** that make the brand vet
trustworthy to both people and search engines.

## Why this is the current bottleneck

On-site SEO is already strong: crawlers get fully rendered HTML, every page
carries JSON-LD, the sitemap carries real `lastmod` values. What the site does
not have yet is off-site authority. Every decent link earned now compounds.

There is also a documented entity problem (see `src/lib/brandSocial.ts`): the
domain once lost its own name queries to a YouTube channel and two GitHub
repos. Links from sites that name the brand correctly actively repair that.

## The quality bar

A link is worth pursuing when it is:

1. **Editorially placed** — a partner page, a directory entry, a blog mention,
   a coverage piece. Someone chose to link.
2. **On-topic** — travel, Ghana, hospitality, tours, Africa, or a partner's
   business site.
3. **Alive** — the page is indexed and the site isn't a link farm.

Do **not** use: paid link networks, PBNs, "100 backlinks for $50" packages,
comment spam, or reciprocal-link schemes at scale. With a young domain, one
penalty costs more than fifty good links earn.

## The four tracks

### A. Listings & profiles — fast wins

Fix what exists first, then create the missing profiles. Everything gets the
canonical URL **https://www.travioghana.com** and consistent NAP (Accra address,
+233 59 140 9761).

Existing presence to correct:

| Where | What to fix |
| --- | --- |
| TripAdvisor (Expedition-Go Tours Ltd listing) | Website field → travioghana.com; consider a second listing for the Travio Ghana platform |
| GetYourGuide supplier profile | Website field |
| Google Business Profile | Claim/verify; website field; add the platform as a product |
| YouTube `@TravioGhana` | Channel "About" link |
| Instagram `@travioghana` / TikTok `@travio.ghana` | Bio link |
| expeditiongotours.com | Add a body link ("Book online via Travio Ghana") — currently no link to the storefront exists anywhere on that site (checked; separate frontend project) |

Then work through `targets.csv`. Two submissions a week is the pace that
actually gets done.

### B. Partner link programme

The scalable channel, and the only one competitors can't copy: **every partner
gets a reason and an easy way to link back.**

- `/partner-resources` is the toolkit: four badge SVGs, copy-paste embed code,
  link snippets, UTM conventions, suggested wording. It exists so the ask is
  "here is a link, click copy" — not "please add a link".
- Bundle the ask into partner activation: when a supplier/hotel/agent/creator
  goes live, send their listing link **and** the toolkit link.
- The toolkit is linked from `/partnerships` and the `/press` page.
- Badges embed referral parameters (`utm_source=PARTNER`) so partner-driven
  traffic is visible in analytics.

### C. Content & digital PR

See `content-calendar.md` for the queue and seasonal lead times. The shape:

- **Guides** that are worth citing: best-time-to-visit, visa, itineraries,
  region guides. Published as stories (`src/components/travelStories.json`),
  which the build already prerenders.
- **Data assets**: a quarterly Ghana Tour Price Index built from the public
  catalogue API, and a "what travellers book in Ghana" seasonality report.
  Journalists cite data; nobody else in Ghana tourism publishes it.
- **PR beats**: Foundation impact stories, new partnerships, seasonal campaigns.
  Pitch to Ghanaian media (Graphic Online, MyJoyOnline, Citi Newsroom,
  GhanaWeb, Pulse Ghana, B&FT) and diaspora travel outlets (Travel Noire etc.).
- **Expert positioning**: Featured.com, Qwoted, SourceBottle (HARO/Connectively
  is gone). The founder is a credible Ghana-travel source.

### D. Entity & reclamation

- **Wikidata**: create an item for Travio Ghana linking official website,
  parent Expedition-Go Tours Ltd, and the social profiles. Feeds the knowledge
  graph; supports the Organization schema the site already emits.
- **Mention monitoring**: Google Alerts + Talkwalker Alerts for
  "Travio Ghana", "Expedition-Go Tours", "Travio Africa". Monthly pass through
  results asking for links on unlinked mentions (`templates.md`, template 7).
- **`sameAs` expansion**: when a new owned profile is created (LinkedIn,
  TripAdvisor operator page), add it to `src/lib/brandSocial.ts`. Note this
  list is mirrored in `scripts/generate-story-pages.cjs` and in the backend's
  `BRANDS` config — coordinate the backend mirror, otherwise entity signals
  split, which is the exact failure the module documents.
- **Press coverage display**: add real mentions to
  `src/data/pressMentions.ts`; the `/press` page renders a "Selected coverage"
  band automatically, and it stays invisible until the list is non-empty.

## Cadence

| Rhythm | Task |
| --- | --- |
| Weekly | 2 listing submissions; review new mentions; add coverage to `pressMentions.ts` |
| Monthly | 1 journalist pitch; 1 linkable content piece; partner-activation link ask audit |
| Quarterly | Publish the price index; KPI review; refresh `targets.csv` |

## KPIs

Tracked in `targets.csv` plus:

- Referring domains (Google Search Console → Links; Ahrefs Webmaster Tools is free)
- Brand query position for "travio ghana" (the entity check)
- Organic sessions to `/tour/*` and `/tours`
- Referral sessions/orders attributable to `utm_source=partner` (analytics page views already capture UTMs)

## Repo touchpoints

| Surface | File |
| --- | --- |
| Press kit | `src/pages/PressPage.tsx` (`/press`) |
| Partner toolkit | `src/pages/PartnerResourcesPage.tsx` (`/partner-resources`) |
| Badges | `public/badges/*.svg` |
| Press downloads | `public/press/*` (regenerate via `sharp` from the brand sources if the logo changes) |
| Coverage band | `src/data/pressMentions.ts` + `src/components/FeaturedIn.tsx` |
| Brand entity list | `src/lib/brandSocial.ts` (keep in sync with story generator + backend) |

Route changes to `/press` and `/partner-resources` must be made in **all**
route tables — `src/App.tsx`, `middleware.ts`, `scripts/prerender-static.mjs`,
`scripts/generate-sitemap.cjs` — or `src/test/crawlerRoutes.test.ts` fails.

## Out of scope (needs other systems)

- Partner onboarding email templates live in the backend repo; paste the
  toolkit URL in manually rather than waiting on a code change.
- The backend's `BRANDS` config mirror for `sameAs` additions.
