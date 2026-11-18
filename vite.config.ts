import { defineConfig, loadEnv, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

/**
 * Serves the Express API (server/app.ts) at /api inside `npm run dev`, so the
 * frontend and the MongoDB-backed API run from one command. In production the
 * same app runs as a Netlify Function (netlify/functions/api.ts).
 */
function apiDevServer(): Plugin {
  return {
    name: 'api-dev-server',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        if (!req.url?.startsWith('/api/')) return next()
        server
          .ssrLoadModule('/server/app.ts')
          .then(({ app }) => app(req, res, next))
          .catch(next)
      })
    },
  }
}

export default defineConfig(({ mode }) => {
  // Expose MONGODB_URI / MONGODB_DB from .env to the API (server side only, never to the browser).
  const env = loadEnv(mode, process.cwd(), 'MONGODB_')
  for (const [k, v] of Object.entries(env)) process.env[k] ??= v
  return { plugins: [react(), tailwindcss(), apiDevServer()] }
})
