import { defineConfig, type Plugin } from 'vite'
import react, { reactCompilerPreset } from '@vitejs/plugin-react'
import babel from '@rolldown/plugin-babel'
import path from 'path'
import { copyFileSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { resolve } from 'node:path'

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

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    babel({ presets: [reactCompilerPreset()] }),
    copyMapboxWorker(),
    copyMaplibreWorker(),
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
