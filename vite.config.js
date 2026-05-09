import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),    // <-- ini kunci untuk Tailwind v4
    VitePWA({
      registerType: 'autoUpdate',
      manifest: {
        name: 'PWM Luxury Ecosystem',
        short_name: 'PWM',
        description: 'Ekosistem store dengan member loyalty',
        theme_color: '#000000',
        background_color: '#000000',
        display: 'standalone',
        icons: []
      }
    })
  ],
})