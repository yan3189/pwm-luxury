import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  base: './', // DS001: agar Capacitor bisa memuat asset dengan benar
  build: {
    outDir: 'dist',
  },
})