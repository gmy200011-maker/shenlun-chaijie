import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  build: {
    outDir: 'dist_v2',
    emptyOutDir: false,
    // Disable minification temporarily for clearer error messages.
    // Re-enable after the React #31 bug is fully resolved.
    minify: false,
    sourcemap: true,
  },
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      },
    },
  },
})
