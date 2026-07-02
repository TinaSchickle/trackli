import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// base: './' sorgt dafür, dass der Build unter jedem GitHub-Pages-Unterpfad
// (https://<user>.github.io/<repo>/) funktioniert, ohne den Repo-Namen
// hier hart eintragen zu müssen.
export default defineConfig({
  plugins: [react()],
  base: './',
  // Cache außerhalb von OneDrive: Sync-Locks auf node_modules/.vite führen
  // sonst zu inkonsistenten Dep-Optimierungen (doppelte React-Kopien).
  cacheDir: join(tmpdir(), 'trackli-vite-cache'),
  optimizeDeps: {
    include: ['react', 'react-dom/client', 'react/jsx-dev-runtime', 'recharts'],
  },
})
