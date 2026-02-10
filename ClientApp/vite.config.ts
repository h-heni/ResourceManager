import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          // Stable vendor chunk — changes rarely, cached aggressively
          'vendor-react': ['react', 'react-dom', 'react-router-dom'],
          'vendor-query': ['@tanstack/react-query', 'axios'],
          'vendor-i18n': ['i18next', 'react-i18next', 'i18next-browser-languagedetector'],
        },
      },
    },
  },
  server: {
        proxy: {
            // Forward all /api calls to the backend
            '/api': {
                target: 'https://localhost:7175', // Use your backend URL here
                secure: false, // Set to false if using self-signed dev certificates
                changeOrigin: true
            }
        },
        port: 5173, // Default Vite port
        strictPort: true
    }
})
