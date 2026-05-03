import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'path'
import fs from 'fs'

const amplifyOutputsPath = path.resolve(__dirname, 'amplify_outputs.json')
const amplifyOutputsExists = fs.existsSync(amplifyOutputsPath)

export default defineConfig({
  plugins: [
    tailwindcss(),
    react(),
    // Provide an empty stub when amplify_outputs.json is absent (CI, Vercel, new dev setup)
    !amplifyOutputsExists && {
      name: 'amplify-outputs-stub',
      resolveId(id: string) {
        if (id.endsWith('amplify_outputs.json')) return '\0amplify-stub'
      },
      load(id: string) {
        if (id === '\0amplify-stub') return 'export default {}'
      },
    },
  ].filter(Boolean),
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
})
