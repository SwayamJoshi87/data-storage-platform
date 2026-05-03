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
    // Stub removed Amplify packages so existing components compile while they are
    // progressively migrated to Clerk + the new API layer (Steps 2–8).
    {
      name: 'amplify-migration-stubs',
      resolveId(id: string) {
        if (
          id === 'aws-amplify' ||
          id.startsWith('aws-amplify/') ||
          id.startsWith('@aws-amplify/')
        ) return `\0amplify-stub:${id}`
        if (!amplifyOutputsExists && id.endsWith('amplify_outputs.json'))
          return '\0amplify-outputs-stub'
      },
      load(id: string) {
        if (id.startsWith('\0amplify-stub:')) return [
          'export default {}',
          // aws-amplify
          'export const Amplify = { configure: () => {} }',
          // @aws-amplify/ui-react
          'export const Authenticator = () => null',
          'export const useAuthenticator = () => ({ user: null, signOut: () => {} })',
          // aws-amplify/auth
          'export const fetchAuthSession = async () => ({})',
          'export const getCurrentUser = async () => ({})',
          'export const signOut = async () => {}',
        ].join('\n')
        if (id === '\0amplify-outputs-stub') return 'export default {}'
      },
    },
  ].filter(Boolean),
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
})
