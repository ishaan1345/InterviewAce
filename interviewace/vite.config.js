import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// https://vitejs.dev/config/
export default defineConfig({
  root: './',
  sourceDir: 'src',
  plugins: [
    react(),
  ],
  css: {
    // Remove explicit postcss config path - let Vite auto-detect postcss.config.cjs
    // postcss: {
    //   configFile: path.resolve(__dirname, './postcss.config.cjs'),
    // },
  },
  build: {
    outDir: path.resolve(__dirname, 'dist'),
    rollupOptions: {
      input: path.resolve(__dirname, 'index.html')
    }
  },
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true
      }
    }
  }
})
