import { defineConfig, type Plugin } from 'vite'
import react, { reactCompilerPreset } from '@vitejs/plugin-react'
import babel from '@rolldown/plugin-babel'
import path from 'path'
import { copyFileSync, mkdirSync } from 'node:fs'
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
      const outDir = resolve(__dirname, 'public/mapbox-gl')
      mkdirSync(outDir, { recursive: true })
      for (const f of files) {
        copyFileSync(resolve(__dirname, 'node_modules/mapbox-gl/dist/esm', f), resolve(outDir, f))
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
function copyMaplibreWorker(): Plugin {
  const files = ['maplibre-gl-worker.mjs', 'maplibre-gl-shared.mjs']
  return {
    name: 'copy-maplibre-worker',
    configResolved() {
      const outDir = resolve(__dirname, 'public/maplibre-gl')
      mkdirSync(outDir, { recursive: true })
      for (const f of files) {
        copyFileSync(resolve(__dirname, 'node_modules/maplibre-gl/dist', f), resolve(outDir, f))
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
      '@': path.resolve(__dirname, './src'),
    },
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
          if (id.includes('node_modules/@tanstack/react-query') || id.includes('node_modules/zustand')) return 'vendor-data'
          if (id.includes('node_modules/i18next') || id.includes('node_modules/react-i18next')) return 'vendor-i18n'
        },
      },
    },
  },
})
