/**
 * One shared Mongoose connection.
 *
 * Serverless functions reuse the same process between requests, so the
 * connection promise is cached on `globalThis` instead of reconnecting
 * on every call. The URI comes from the MONGODB_URI environment variable
 * (`.env` locally, Netlify site settings in production). Never hardcode it.
 * autoIndex is off so cold starts stay fast: `npm run db:seed` builds the indexes.
 */
import mongoose from 'mongoose'

const cache = globalThis as typeof globalThis & { __mongo?: Promise<typeof mongoose> }

export function connectDB(): Promise<typeof mongoose> {
  const uri = process.env.MONGODB_URI
  if (!uri) throw new Error('MONGODB_URI is not set. Copy .env.example to .env and fill it in.')
  cache.__mongo ??= mongoose
    .connect(uri, { dbName: process.env.MONGODB_DB || 'chronic_disease_tracker', serverSelectionTimeoutMS: 10_000, autoIndex: false })
    .catch((err) => {
      cache.__mongo = undefined // let the next request retry
      throw err
    })
  return cache.__mongo
}

export function disconnectDB() {
  cache.__mongo = undefined
  return mongoose.disconnect()
}
