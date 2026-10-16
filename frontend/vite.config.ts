import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  // Pages publica em /cidup/; localmente e no Docker a base continua /.
  base: process.env.VITE_BASE ?? '/',
  plugins: [react()],
  // Docker em Windows não propaga eventos de arquivo para o volume.
  server: { watch: { usePolling: true } },
})
