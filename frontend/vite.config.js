import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          'vendor-react': ['react', 'react-dom', 'react-router-dom'],
          'vendor-ui': ['lucide-react', 'react-hot-toast'],
        },
      },
    },
  },
  server: {
    port: 5173,
    // Allow requests from ngrok tunnels (any subdomain)
    allowedHosts: ['localhost', '.ngrok-free.app', '.ngrok.io', '.trycloudflare.com'],
    proxy: {
      '/api': {
        target: 'http://localhost:8001',
        changeOrigin: true,
      },
    },
  },
})
