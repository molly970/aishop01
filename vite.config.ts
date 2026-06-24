import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  appType: 'spa',
  plugins: [react()],
  cacheDir: '.vite-aishop01',
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    host: '0.0.0.0',
    port: 4273,
    strictPort: true,
    proxy: {
      '/api': {
        target: 'http://localhost:3004',
        changeOrigin: true,
      },
      '/uploads': {
        target: 'http://localhost:3004',
        changeOrigin: true,
      },
    },
  },
})
