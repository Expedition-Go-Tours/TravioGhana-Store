import { defineConfig, loadEnv, type Plugin } from 'vite'
import react, { reactCompilerPreset } from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'
import babel from '@rolldown/plugin-babel'
import path from 'path'
import { copyFileSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { resolve } from 'node:path'
import { searchGhanaPlaces } from './middleware.ts'
import { noClientSerpKeyPlugin } from './server/noClientSerpKey.ts'

// mapbox-gl's ESM worker (`dist/esm/worker.js`) must be served VERBATIM with
// its whole module closure: Vite's production build rewrites its `?url` asset
// into a module that statically imports `./shared.js` (and dynamically
// `./raster_array.worker.js`), none of which get emitted — the worker 404s and
// the Mapbox map can't paint tiles (it only appears after the failover
// watchdogs, the "map takes very long to load" on Vercel). Serving the raw
// worker + its shared/worker chunks from `public/` keeps every relative import
// resolvable and untransformed in dev and production alike.
function copyMapboxWorker(): Plugin {
  const files = [
    'worker.js',
    'shared.js',
    'hd.worker.js',
    'standard.worker.js',
    'raster_array.worker.js',
    'hd.shared.js',
    'standard.shared.js',
    'hd_standard.model.js',
    'raster_array.shared.js',
  ]
  return {
    name: 'copy-mapbox-worker',
    configResolved() {
      const outDir = resolve(import.meta.dirname, 'public/mapbox-gl')
      mkdirSync(outDir, { recursive: true })
      for (const f of files) {
        copyFileSync(resolve(import.meta.dirname, 'node_modules/mapbox-gl/dist/esm', f), resolve(outDir, f))
      }
    },
  }
}

// maplibre-gl's worker (`maplibre-gl-worker.mjs`) is a MODULE worker that
// imports its shared chunk (`./maplibre-gl-shared.mjs`). Vite's `?url` import
// copies the worker into dist/assets/ verbatim but never emits that relative
// chunk next to it, so on the deployed build the worker fails to boot and the
// map can't parse tiles — it hangs until the failover watchdogs (the "map
// takes very long to load" on Vercel). Serving the worker + its shared chunk
// raw from `public/` keeps the relative import resolvable in dev and prod.
//
// Both files are emitted under CONTENT-HASHED names and the worker's import of
// the shared chunk is rewritten to the hashed name. The URL used to be fixed
// (`maplibre-gl-worker.mjs`), but its content changes whenever maplibre-gl is
// upgraded — browsers that cached a previous worker (or a 404 from an older
// broken build) under an `immutable` cache pairing it with a newer shared
// chunk made every worker boot fail ("Worker failed to load"), leaving the map
// blank until the Mapbox fallback took over. A content hash makes each build a
// new URL, so stale caches can never pair mismatched chunks again.
function copyMaplibreWorker(): Plugin {
  let workerFileName = ''
  let sharedFileName = ''
  let workerSource = ''
  let sharedSource = ''

  return {
    name: 'copy-maplibre-worker',
    // `config` runs before the config is resolved, so the hashed URL can be
    // injected as the `__MAP_WORKER_URL__` global used by src/lib/mapWarmup.ts.
    config() {
      const srcDir = resolve(import.meta.dirname, 'node_modules/maplibre-gl/dist')
      workerSource = readFileSync(resolve(srcDir, 'maplibre-gl-worker.mjs'), 'utf8')
      sharedSource = readFileSync(resolve(srcDir, 'maplibre-gl-shared.mjs'), 'utf8')
      const hash = createHash('sha256')
        .update(sharedSource)
        .update(workerSource)
        .digest('hex')
        .slice(0, 10)
      sharedFileName = `maplibre-gl-shared.${hash}.mjs`
      workerFileName = `maplibre-gl-worker.${hash}.mjs`
      workerSource = workerSource.replaceAll(
        './maplibre-gl-shared.mjs',
        `./${sharedFileName}`,
      )
      return {
        define: {
          __MAP_WORKER_URL__: JSON.stringify(`/maplibre-gl/${workerFileName}`),
        },
      }
    },
    configResolved() {
      const outDir = resolve(import.meta.dirname, 'public/maplibre-gl')
      mkdirSync(outDir, { recursive: true })
      writeFileSync(resolve(outDir, workerFileName), workerSource)
      writeFileSync(resolve(outDir, sharedFileName), sharedSource)
      // Drop previously generated hashed copies so public/ never accumulates.
      for (const f of readdirSync(outDir)) {
        if (
          /^maplibre-gl-(worker|shared)\..*\.mjs$/.test(f) &&
          f !== workerFileName &&
          f !== sharedFileName
        ) {
          rmSync(resolve(outDir, f))
        }
      }
    },
  }
}

// Serves the same-origin SerpApi Google Maps search route that production's
// Vercel middleware (middleware.ts) owns, so `vite dev` behaves like the
// deployed site. Without this, /api/maps-search would fall through to the SPA
// shell and the pickup picker's "Search Google Maps" option would be dead in
// local development.
function serpApiMapsDevRoute(): Plugin {
  let apiKey = ''
  return {
    name: 'serpapi-maps-dev-route',
    configResolved(config) {
      // `loadEnv` with an empty prefix reads every variable (VITE_-prefixed or
      // not) into this dev-server process only — the client bundle is governed
      // by Vite's own env handling, and the no-client-serp-key guard makes the
      // key impossible to inline there. Falls back to the original
      // SERPAPI_API_KEY alias.
      const env = loadEnv(config.mode, config.envDir, '')
      apiKey =
        env.VITE_SERP_API_KEY ||
        env.SERPAPI_API_KEY ||
        process.env.VITE_SERP_API_KEY ||
        process.env.SERPAPI_API_KEY ||
        ''
    },
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const url = new URL(req.url || '/', 'http://localhost')
        if (url.pathname !== '/api/maps-search') {
          next()
          return
        }
        void (async () => {
          const q = (url.searchParams.get('q') || '').trim()
          const latRaw = url.searchParams.get('lat')
          const lngRaw = url.searchParams.get('lng')
          let result: unknown
          if (q.length < 3 || q.length > 120 || (latRaw != null) !== (lngRaw != null)) {
            res.statusCode = 400
            result = { ok: false, reason: 'invalid' }
          } else {
            const lat = latRaw == null ? NaN : Number(latRaw)
            const lng = lngRaw == null ? NaN : Number(lngRaw)
            const origin = Number.isFinite(lat) && Number.isFinite(lng) ? { lat, lng } : null
            result = await searchGhanaPlaces(q, origin, apiKey)
          }
          res.setHeader('Content-Type', 'application/json; charset=utf-8')
          res.end(JSON.stringify(result))
        })()
      })
    },
  }
}

// Progressive Web App support: a service worker that precaches the built
// assets and serves the SPA shell offline.
//
// VITE_ENABLE_PWA=0 is a kill switch, not just "don't register": the worker is
// still built but `selfDestroying` makes it unregister itself on the devices
// that already have it, and the app stops registering (see main.tsx). The
// plugin stays in the chain either way so `virtual:pwa-register` resolves.
const pwaEnabled = process.env.VITE_ENABLE_PWA !== '0'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    babel({ presets: [reactCompilerPreset()] }),
    copyMapboxWorker(),
    copyMaplibreWorker(),
    serpApiMapsDevRoute(),
    noClientSerpKeyPlugin(),
    VitePWA({
      // The hand-written site.webmanifest is the single source of truth for
      // name, icons and colours; the plugin only builds the worker.
      manifest: false,
      injectRegister: null,
      registerType: 'autoUpdate',
      selfDestroying: !pwaEnabled,
      workbox: {
        // Code, fonts and icons only: a tour site's images are megabytes and
        // there are hundreds of them, so they are cached on first view (below)
        // rather than downloaded before the app is even usable.
        globPatterns: ['**/*.{js,css,html,ico,svg,woff2}'],
        // __seo/ is the crawler-only prerender; the map workers are huge and
        // useless offline (tiles and the API need the network).
        globIgnores: ['**/__seo/**', '**/mapbox-gl/**', '**/maplibre-gl-*'],
        navigateFallback: '/index.html',
        cleanupOutdatedCaches: true,
        clientsClaim: true,
        skipWaiting: true,
        runtimeCaching: [
          {
            // Prices, availability and auth are never cached. A stale price in
            // an installed app is a support ticket and a chargeback. Cross-origin
            // only: `www.travioghana.com` ends with these hostnames too, and
            // matching it would push every same-origin request straight to the
            // network and skip the caches below.
            urlPattern: ({ url, sameOrigin }: { url: URL; sameOrigin: boolean }) =>
              !sameOrigin &&
              (url.hostname.endsWith('travioghana.com') ||
                url.hostname.endsWith('travioafrica.com')),
            handler: 'NetworkOnly',
          },
          {
            // First-party images fill the cache as the visitor browses.
            urlPattern: ({ url, sameOrigin }: { url: URL; sameOrigin: boolean }) =>
              sameOrigin && /\.(?:png|webp|jpe?g|gif|avif)$/i.test(url.pathname),
            handler: 'CacheFirst',
            options: {
              cacheName: 'site-images',
              expiration: { maxEntries: 120, maxAgeSeconds: 60 * 60 * 24 * 30 },
            },
          },
          {
            urlPattern: ({ url }: { url: URL }) => url.hostname.includes('cloudinary.com'),
            handler: 'StaleWhileRevalidate',
            options: {
              cacheName: 'cloudinary-images',
              expiration: { maxEntries: 200, maxAgeSeconds: 60 * 60 * 24 * 30 },
            },
          },
          {
            urlPattern: ({ url }: { url: URL }) =>
              url.hostname.endsWith('googleapis.com') && url.pathname.startsWith('/css'),
            handler: 'StaleWhileRevalidate',
            options: {
              cacheName: 'google-fonts-stylesheets',
              expiration: { maxEntries: 10, maxAgeSeconds: 60 * 60 * 24 * 365 },
            },
          },
        ],
      },
    }),
  ],
  resolve: {
    alias: {
      '@': path.resolve(import.meta.dirname, './src'),
    },
    // One React instance, always. A second copy (from a nested install or a
    // duplicated chunk) breaks hooks and React.lazy in ways that surface as
    // "reading 'default' of undefined" deep inside lazyInitializer.
    dedupe: ['react', 'react-dom', 'react-router', 'react-router-dom'],
  },
  optimizeDeps: {
    // maplibre-gl spawns its render worker via `new URL('./maplibre-gl-worker.mjs',
    // import.meta.url)`; pre-bundling would resolve it inside .vite/deps where
    // the worker is never emitted, leaving every map blank in dev. Serving the
    // package un-bundled keeps that URL pointing at the real worker file.
    // mapbox-gl's ESM build does the same with its `worker.js` chunk.
    exclude: ['maplibre-gl', 'mapbox-gl'],
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks(id: string) {
          if (id.includes('node_modules/react-dom') || id.includes('node_modules/react/') || id.includes('node_modules/react-router')) return 'vendor-react'
          if (id.includes('node_modules/framer-motion') || id.includes('node_modules/lucide-react')) return 'vendor-ui'
          // react-query and zustand live in vendor-react, not their own chunk.
          // Rolldown hoists React's shared CJS wrapper into whichever chunk
          // requires it first; a separate vendor-data chunk made it emit React
          // core there while react-dom imported it back, which is the layout
          // behind the production "reading 'default' of undefined" crash in
          // React.lazy. Keeping React and its consumers in one chunk removes it.
          if (id.includes('node_modules/@tanstack/react-query') || id.includes('node_modules/zustand')) return 'vendor-react'
          if (id.includes('node_modules/i18next') || id.includes('node_modules/react-i18next')) return 'vendor-i18n'
        },
      },
    },
  },
})
