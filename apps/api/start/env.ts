/*
|--------------------------------------------------------------------------
| Environment variables service
|--------------------------------------------------------------------------
*/

import { Env } from '@adonisjs/core/env'

export default await Env.create(new URL('../', import.meta.url), {
  NODE_ENV: Env.schema.enum(['development', 'production', 'test'] as const),
  PORT: Env.schema.number(),
  HOST: Env.schema.string({ format: 'host' }),
  LOG_LEVEL: Env.schema.string(),

  APP_KEY: Env.schema.secret(),
  APP_URL: Env.schema.string({ format: 'url', tld: false }),

  SESSION_DRIVER: Env.schema.enum(['cookie', 'memory', 'database'] as const),

  DB_HOST: Env.schema.string({ format: 'host' }),
  DB_PORT: Env.schema.number(),
  DB_USER: Env.schema.string(),
  DB_PASSWORD: Env.schema.string.optional(),
  DB_DATABASE: Env.schema.string(),

  CORS_ORIGIN: Env.schema.string.optional(),

  GOOGLE_CLIENT_ID: Env.schema.string.optional(),
  GOOGLE_CLIENT_SECRET: Env.schema.string.optional(),
  FACEBOOK_CLIENT_ID: Env.schema.string.optional(),
  FACEBOOK_CLIENT_SECRET: Env.schema.string.optional(),
  APPLE_CLIENT_ID: Env.schema.string.optional(),
  APPLE_CLIENT_SECRET: Env.schema.string.optional(),

  /**
   * Angular / Capacitor origin used in mail deep links (verify + reset).
   */
  FRONTEND_URL: Env.schema.string({ format: 'url', tld: false }),

  /*
  |----------------------------------------------------------
  | Variables for configuring the mail package
  |----------------------------------------------------------
  */
  MAIL_MAILER: Env.schema.enum(['smtp'] as const),
  MAIL_FROM_NAME: Env.schema.string(),
  MAIL_FROM_ADDRESS: Env.schema.string(),
  SMTP_HOST: Env.schema.string(),
  SMTP_PORT: Env.schema.number(),
  SMTP_USERNAME: Env.schema.string.optional(),
  SMTP_PASSWORD: Env.schema.string.optional(),

  /*
  |----------------------------------------------------------
  | Catalog enrichment — Open Food Facts (primary) + UPCitemdb nurse
  |----------------------------------------------------------
  */
  OFF_API_BASE_URL: Env.schema.string({ format: 'url', tld: false }),
  OFF_USER_AGENT: Env.schema.string(),
  UPCITEMDB_ENABLED: Env.schema.boolean(),
  UPCITEMDB_API_BASE_URL: Env.schema.string({ format: 'url', tld: false }),
  UPCITEMDB_USER_KEY: Env.schema.string.optional(),
  UPCITEMDB_KEY_TYPE: Env.schema.string.optional(),
})
