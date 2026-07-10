import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// base './' keeps asset paths relative so the same build works on Vercel
// and on GitHub Pages (which serves from a /repo-name/ subpath).
export default defineConfig({
  plugins: [react()],
  base: './',
})
