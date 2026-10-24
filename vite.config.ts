import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
export default defineConfig({
  root: 'web',
  plugins: [react()],
  build: { outDir: '../dist/web', emptyOutDir: true },
  server: {
    port: 5173,
    strictPort: true,
    proxy: {
      '^/api(?:/|$)': `http://127.0.0.1:${process.env.VITE_API_PORT || '4100'}`,
      '^/auth(?:/|$)': `http://127.0.0.1:${process.env.VITE_API_PORT || '4100'}`,
    },
  },
})
