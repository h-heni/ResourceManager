import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
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
