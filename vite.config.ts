import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { env } from 'node:process'

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api': {
        target: env.SPRING_API_URL ?? 'http://127.0.0.1:8080',
        changeOrigin: true,
      },
    },
  },
})
