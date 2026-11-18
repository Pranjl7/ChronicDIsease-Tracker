/**
 * Netlify Function that serves the whole REST API.
 * netlify.toml rewrites /api/* to this function, so the frontend just calls /api/...
 * Set MONGODB_URI (and optionally MONGODB_DB) in Netlify: Site configuration → Environment variables.
 */
import serverless from 'serverless-http'
import { app } from '../../server/app'

export const handler = serverless(app)
