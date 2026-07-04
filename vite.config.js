import { readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Ersetzt __BUILD_ID__ im gebauten Service Worker durch einen Zeitstempel,
// damit jeder Build einen neuen Cache-Namen hat (Cache-Busting).
function serviceWorkerBuildId() {
  return {
    name: 'service-worker-build-id',
    apply: 'build',
    closeBundle() {
      const swPath = join('dist', 'service-worker.js')
      try {
        const src = readFileSync(swPath, 'utf8')
        writeFileSync(swPath, src.replace('__BUILD_ID__', Date.now().toString()))
      } catch (err) {
        this.warn(`Service-Worker Build-ID konnte nicht gesetzt werden: ${err.message}`)
      }
    },
  }
}

// base: './' sorgt dafür, dass der Build unter jedem GitHub-Pages-Unterpfad
// (https://<user>.github.io/<repo>/) funktioniert, ohne den Repo-Namen
// hier hart eintragen zu müssen.
export default defineConfig({
  plugins: [react(), serviceWorkerBuildId()],
  base: './',
  // Cache außerhalb von OneDrive: Sync-Locks auf node_modules/.vite führen
  // sonst zu inkonsistenten Dep-Optimierungen (doppelte React-Kopien).
  cacheDir: join(tmpdir(), 'trackli-vite-cache'),
  optimizeDeps: {
    include: ['react', 'react-dom/client', 'react/jsx-dev-runtime', 'recharts'],
  },
})
