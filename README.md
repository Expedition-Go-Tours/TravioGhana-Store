<div align="center">
  <img src="docs/images/logo.png" alt="Travio Ghana — An Expedition-Go Tours Company" width="240" />

  # Travio Ghana Storefront

  **The customer-facing booking surface of a Ghana travel marketplace.**

  Tours, safaris and experiences across Accra, Cape Coast, the Volta Region and beyond —
  searched, booked and paid for end to end.

  [**Live site →**](https://www.travioghana.com) · [Supplier portal →](https://supplier.travioghana.com) · [Run it locally →](#getting-started)

  ![React](https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=white)
  ![TypeScript](https://img.shields.io/badge/TypeScript-6-3178C6?logo=typescript&logoColor=white)
  ![Vite](https://img.shields.io/badge/Vite-8-646CFF?logo=vite&logoColor=white)
  ![Tailwind CSS](https://img.shields.io/badge/Tailwind-3.4-38B2AC?logo=tailwindcss&logoColor=white)
  ![Tests](https://img.shields.io/badge/tests-926_passing-2E7D32)
  ![License](https://img.shields.io/badge/license-private-lightgrey)
</div>

<br>

![Travio Ghana homepage](docs/images/home-hero.webp)

---

## Table of contents

- [What this is](#what-this-is)
- [Product surface](#product-surface)
- [Architecture](#architecture)
  - [Two audiences, two documents](#two-audiences-two-documents)
  - [Who serves what](#who-serves-what)
- [Tech stack](#tech-stack)
- [Getting started](#getting-started)
- [Environment variables](#environment-variables)
- [Commands](#commands)
- [Quality gates](#quality-gates)
- [Project structure](#project-structure)
- [Deployment](#deployment)
- [Related repositories](#related-repositories)
- [License](#license)

---

## What this is

A single-page React application that acts as the public storefront for the Travio Ghana
marketplace. Visitors discover tours, compare them, and complete a booking with payment —
while suppliers list and manage the inventory being sold.

It is the front half of a two-sided platform:

| Role | Where they go | Repo |
| --- | --- | --- |
| **Traveller** | [www.travioghana.com](https://www.travioghana.com) | **this repo** |
| **Supplier** | [supplier.travioghana.com](https://supplier.travioghana.com) | [`TravioGhana-Supplier`](https://github.com/Expedition-Go-Tours/TravioGhana-Supplier) |
| **API / payments / prerender** | `apiv1.travioafrica.com` | [`Expedition-Go-Backend-v2`](https://github.com/Expedition-Go-Tours/Expedition-Go-Backend-v2) |

## Product surface

- **Search & discovery** — free-text search over cities, towns, attractions and regions;
  faceted listing pages with `?place=` destination URLs that index independently.
- **Tour detail pages** — availability calendar, tiered pricing, group rates, special
  offers, inclusions, and reviews aggregated from this site plus TripAdvisor and
  GetYourGuide.
- **Booking & checkout** — pickup selection, Stripe Elements with 3-D Secure confirmation,
  booking confirmation, and post-booking modification and cancellation flows.
- **Accounts** — email/password plus Google OAuth and Google One Tap; wishlists, booking
  history, a traveller dashboard and in-app chat.
- **Partner programmes** — supplier self-onboarding (`/supplier/register`,
  `/supplier/list-experience`), hotels, transport providers, travel agents and content
  creators each have their own application flow.
- **Editorial** — `/stories` travel writing and a blog, both prerendered to static HTML.
- **Internationalisation** — i18next, with locale and currency selection in the header.

## Architecture

### Two audiences, two documents

Browsers get a **~5 KB shell** that hydrates after load. Crawlers get **~571 KB of fully
rendered HTML**. They are not the same document, and that is deliberate.

`middleware.ts` matches roughly 50 crawler user-agents — Googlebot (desktop *and*
smartphone), Bingbot, Baiduspider, `Google-InspectionTool`, `facebookexternalhit`, and the
AI/SEO fetchers — and rewrites those requests to prerendered HTML instead of the SPA shell.

```
                         ┌──────────────────────────┐
   browser  ───────────► │  index.html  (5 KB SPA)  │ ── hydrates to the same DOM
                         └──────────────────────────┘
   crawler  ───────────► middleware.ts (UA match)
                              │
                              ├─ 20 static routes ─► dist/__seo/<route>/index.html   (build time)
                              ├─ /tour/* , /tours ─► apiv1 …/api/prerender           (live data)
                              └─ /stories/* ───────► static HTML from scripts/
```

The static routes are produced by `scripts/prerender-static.mjs`, which drives a real
browser against a production build and writes what it sees. Because it renders the actual
app, its copy cannot drift from what a visitor sees.

Three files must agree on which routes are static, and a unit test enforces it:

| File | Holds |
| --- | --- |
| `middleware.ts` → `PRERENDER_ROUTES` | routes rewritten to `dist/__seo/` |
| `scripts/prerender-static.mjs` → `ROUTES` | routes prerendered at build time |
| `scripts/generate-sitemap.cjs` → `STATIC_PAGES` | routes published in `sitemap.xml` |

### Who serves what

| Route class | Served by | Why |
| --- | --- | --- |
| `/`, `/about-us`, `/blog`, `/faq`, policies (20) | build-time `dist/__seo/` | static copy, cannot drift from the app |
| `/tour/:id/:slug`, `/tours`, `/tours?place=…` | backend prerender | needs live prices and availability |
| `/stories`, `/stories/:slug` | `scripts/generate-story-pages.cjs` | client-side data a crawler cannot read |
| `/dashboard/*`, `/booking/*`, `/auth/*`, `/api/*` | never prerendered | private; excluded in `SKIP_PATHS` |

Every crawler-facing tag — `<title>`, meta description, canonical, `robots`, `og:*`,
`twitter:*` and JSON-LD — is emitted from a single source: `src/components/SEO.tsx`.
Pages never hardcode them. The Organization node (with the brand's `sameAs` profiles) is
injected on every page rather than left to a page to remember.

## Tech stack

| Layer | Choice |
| --- | --- |
| UI | React 19, React Router 7, TypeScript 6 |
| Styling | Tailwind CSS 3.4 (utility classes) + 135 plain CSS files |
| Build | Vite 8, rolldown |
| Head / SEO | `react-helmet-async`, build-time prerender, JSON-LD |
| i18n | i18next |
| Payments | Stripe Elements (3-D Secure confirmation) |
| Maps | MapLibre + OpenStreetMap, Google Maps when a key is configured |
| Tests | Vitest + Testing Library (93 files, 926 tests) |
| Lint | ESLint 10 |

## Getting started

**Prerequisites:** Node.js 24 and npm. The repo pins neither an `engines` field nor an
`.nvmrc`, so any modern Node that runs Vite 8 will do.

```bash
git clone git@github.com:Expedition-Go-Tours/TravioGhana-Store.git
cd TravioGhana-Store
npm install
cp .env.example .env
npm run dev
```

Vite serves the app on `http://localhost:5173` and proxies nothing — API calls go
straight to whatever origin you configure in `.env`.

### ⚠️ One environment variable will silently break auth

```dotenv
VITE_AUTH_PROVIDER=backend
```

**This must be `backend` in every deployed build.** If it is missing, the app ships the
`mock` provider and signs everyone in as `user@gmail.com`. `mock` exists solely for local
UI work with no backend running.

## Environment variables

All of them are documented inline in [`.env.example`](.env.example) — copy it rather than
writing one from scratch. The ones you are most likely to touch:

| Variable | Purpose |
| --- | --- |
| `VITE_AUTH_PROVIDER` | `backend` in production, `mock` only for local UI work |
| `VITE_API_URL` | backend API origin |
| `VITE_AUTH_API_BASE_URL` | overrides the API origin for auth endpoints |
| `VITE_STRIPE_PUBLISHABLE_KEY` | Stripe Elements + 3DS confirmation |
| `VITE_GOOGLE_CLIENT_ID` | Google One Tap sign-in (must match the backend's) |
| `VITE_GOOGLE_MAPS_API_KEY` | optional; the booking map falls back to MapLibre without it |
| `VITE_SUPPLIER_PLATFORM_URL` | where approved suppliers are redirected to sign in |

Values are inlined at build time — changing one requires a rebuild, not a redeploy of
static files.

## Commands

| Command | What it does |
| --- | --- |
| `npm run dev` | Vite dev server with hot reload |
| `npm test` | full Vitest suite |
| `npm run test:watch` | Vitest in watch mode |
| `npm run lint` | ESLint across the repo |
| `npm run build` | `tsc -b` → `vite build` → prerender the 20 static routes |
| `npm run preview` | preview the production build locally |
| `npm run sitemap` | regenerate `public/sitemap.xml` |
| `npm run prerender` | regenerate `dist/__seo/` only |
| `npm run verify:links` | resolve every `/tour/` link in the build against the live API |
| `npm run perf:mobile` | throttled Core Web Vitals audit against a production build |
| `npm run generate-favicons` | regenerate the versioned `/icons/v2/` set |
| `npm run extract` | extract i18next translation keys |

## Quality gates

- **Tests** — 93 files / 926 tests. Includes assertions that the *prerender artifact*
  keeps a single `<title>`, that crawler routes stay in sync across the three route
  tables, and that the Organization schema appears on every page.
- **Lint** — `npm run lint` exits 0 (warnings only).
- **Type check** — `tsc -b` runs as the first step of every build.
- **Link gate** — `npm run verify:links` fails the run if any built `/tour/` link 404s
  against the live API. It is deliberately **not** part of `npm run build`, because a build
  should not fail when the API is briefly unreachable. Run it explicitly before deploying.
- **Performance budget** — `npm run perf:mobile` records FCP, LCP, CLS, total blocking
  time and bytes by resource type under CPU/network throttling; `--check` fails against
  the stored budget. `.github/workflows/perf.yml` runs it on pushes to `main`.
- **Icons** — `scripts/check-icons.cjs` verifies the favicon set during `prebuild`.

## Project structure

```
TravioGhana-Store/
├── index.html                 # SPA shell; the single <head> every page inherits
├── middleware.ts              # crawler detection → prerender rewrite
├── docs/                      # README assets
├── public/
│   ├── data/                  # external review stats, shipped at build time
│   └── icons/v2/              # versioned favicons (browsers cache by URL)
├── scripts/
│   ├── prerender-static.mjs   # renders 20 routes → dist/__seo/
│   ├── generate-sitemap.cjs   # 76-URL sitemap
│   ├── generate-story-pages.cjs
│   ├── build-review-stats.cjs
│   ├── verify-build-links.mjs # production link gate
│   └── perf/audit-mobile.mjs  # Core Web Vitals budget
├── src/
│   ├── components/            # 149 components, incl. SEO.tsx (all crawler tags)
│   ├── pages/                 # 94 route components
│   ├── features/              # feature modules
│   ├── lib/                   # brandSocial, tourPath, pricing helpers
│   ├── i18n/                  # i18next resources
│   └── test/                  # cross-cutting SEO & prerender tests
└── .github/workflows/         # mobile perf, nightly external review sync
```

## Deployment

Deployed on **Vercel from `main`**. `prebuild` regenerates the sitemap, story pages and
review stats, then `build` type-checks, bundles and prerenders.

Two GitHub Actions run independently of the deploy:

| Workflow | Trigger | Notes |
| --- | --- | --- |
| `perf.yml` | push to `main` | mobile performance budget |
| `sync-reviews.yml` | daily 06:00 UTC + manual | refreshes external review stats and pushes back to `main` |

Before a deploy worth being careful about, run `npm run verify:links`.

## Related repositories

| Repository | Role |
| --- | --- |
| [`Expedition-Go-Backend-v2`](https://github.com/Expedition-Go-Tours/Expedition-Go-Backend-v2) | API, payments, Prisma/Postgres, and the runtime prerenderer |
| [`TravioGhana-Supplier`](https://github.com/Expedition-Go-Tours/TravioGhana-Supplier) | supplier dashboard |
| [`TravioGhana-Store`](https://github.com/Expedition-Go-Tours/TravioGhana-Store) | this repo |
| [`travio-decap-oauth`](https://github.com/Expedition-Go-Tours/travio-decap-oauth) | Decap CMS OAuth provider for editorial workflows |

## License

Private and proprietary. No license is granted. © Expedition-Go Tours LTD.
