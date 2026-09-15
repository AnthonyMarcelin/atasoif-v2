import env from '#start/env'
import app from '@adonisjs/core/services/app'
import { defineConfig } from '@adonisjs/cors'

/**
 * Resolve allowed origins from CORS_ORIGIN (comma-separated).
 * Falls back to permissive localhost reflection in development when unset,
 * and an empty allowlist in production (no cross-origin until configured).
 */
function resolveCorsOrigin(): boolean | string[] {
  const raw = env.get('CORS_ORIGIN')
  if (raw) {
    const origins = raw
      .split(',')
      .map((origin) => origin.trim())
      .filter(Boolean)
    if (origins.length > 0) {
      return origins
    }
  }

  return app.inDev ? true : []
}

/**
 * Configuration options to tweak the CORS policy. The following
 * options are documented on the official documentation website.
 *
 * https://docs.adonisjs.com/guides/security/cors
 */
const corsConfig = defineConfig({
  /**
   * Enable or disable CORS handling globally.
   */
  enabled: true,

  /**
   * Allow apps/web (and other listed origins) via CORS_ORIGIN.
   * Example: CORS_ORIGIN=http://localhost:4200
   */
  origin: resolveCorsOrigin(),

  /**
   * HTTP methods accepted for cross-origin requests.
   */
  methods: ['GET', 'HEAD', 'POST', 'PUT', 'PATCH', 'DELETE'],

  /**
   * Reflect request headers by default. Use a string array to restrict
   * allowed headers.
   */
  headers: true,

  /**
   * Response headers exposed to the browser.
   */
  exposeHeaders: [],

  /**
   * Allow cookies/authorization headers on cross-origin requests.
   */
  credentials: true,

  /**
   * Cache CORS preflight response for N seconds.
   */
  maxAge: 90,
})

export default corsConfig
