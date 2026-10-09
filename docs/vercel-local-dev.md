# Local Vercel dev (`vercel dev`) — testing Routing Middleware

`vite dev` does **not** run `middleware.ts`. Vercel executes the Routing
Middleware in its own runtime, so middleware-only failures are invisible until
deployment. That is exactly how the 2026-10-09 production outage happened:

> `middleware.ts` imported `./server/serpApiMaps` (extensionless). Because
> `package.json` has `"type": "module"`, Vercel runs the middleware as native
> ESM — extensionless relative imports fail there, the middleware failed to
> load, and **every** request returned `500 MIDDLEWARE_INVOCATION_FAILED`.

Run `vercel dev` before pushing any change to `middleware.ts` and load `/` plus
`/api/maps-search` — a middleware that fails to load 500s every route, which is
impossible to miss.

## One-time setup

```bash
npx vercel login     # interactive: GitHub / email
npx vercel link      # choose the existing TravioGhana-Store project
```

`vercel link` creates `.vercel/project.json` (org + project IDs); it is
gitignored.

## Run the full app locally (with middleware)

```bash
npm run vercel:dev   # → http://localhost:3000
```

`vercel dev` builds and serves the app **with the real Vercel runtime**,
including `middleware.ts`.

## Environment variables

- **Client (`VITE_*`)** — `vercel dev` runs the Vite dev server, which reads
  the local `.env` exactly like `npm run dev`.
- **Server-side (middleware)** — the middleware reads `process.env`, which
  `vercel dev` populates from the linked project's environment variables.
  Pull them once with:

  ```bash
  npx vercel env pull .env.development.local
  ```

  Without this, `/api/maps-search` answers
  `{"ok": false, "reason": "not_configured"}` — the UI stays functional and
  simply hides the Google Maps option.

## Checklist before pushing middleware changes

1. `npm run vercel:dev`
2. `curl -i http://localhost:3000/` → `200` (a load failure gives `500`)
3. `curl -i http://localhost:3000/about-us/` → `308` to `/about-us`
4. `curl -i "http://localhost:3000/api/maps-search?q=Kaneshi"` → JSON, not HTML
5. `npm run test` + `npx tsc -b`

## Rule: `middleware.ts` must stay import-free

The Vercel runtime loads the middleware as native ESM. Keep `middleware.ts`
self-contained (no imports); shared helpers used by tests or the Vite dev
route can be **exported from** `middleware.ts`, never imported **into** it.
See the warning comment at the top of the file.
