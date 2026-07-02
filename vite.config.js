import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// base: './' sorgt dafür, dass der Build unter jedem GitHub-Pages-Unterpfad
// (https://<user>.github.io/<repo>/) funktioniert, ohne den Repo-Namen
// hier hart eintragen zu müssen.
export default defineConfig({
  plugins: [react()],
  base: './',
})
