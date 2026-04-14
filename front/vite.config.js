import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import vuetify from 'vite-plugin-vuetify'

const apiTarget = process.env.VITE_API_PROXY_TARGET || 'http://localhost:4100'

export default defineConfig({
  plugins: [vue(), vuetify({ autoImport: true })],
  server: {
    proxy: {
      '/api': {
        target: apiTarget,
        changeOrigin: true,
      },
    },
  },
})
