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
  /** Services ID for web SIWA (e.g. com.atasoif.web). */
  APPLE_CLIENT_ID: Env.schema.string.optional(),
  /**
   * Legacy static client_secret JWT — unused when TEAM_ID + KEY_ID + PRIVATE_KEY are set.
   * Prefer runtime JWT from the .p8 key (see apple_client_secret service).
   */
  APPLE_CLIENT_SECRET: Env.schema.string.optional(),
  /** Apple Developer Team ID (JWT iss). */
  APPLE_TEAM_ID: Env.schema.string.optional(),
  /** Sign in with Apple key id (JWT header kid). */
  APPLE_KEY_ID: Env.schema.string.optional(),
  /** PEM contents of the Apple .p8 key (\n escapes OK). Never log. */
  APPLE_PRIVATE_KEY: Env.schema.string.optional(),
  /** iOS bundle id (e.g. fr.atasoif.app) — optional until native SIWA. */
  APPLE_BUNDLE_ID: Env.schema.string.optional(),

  /**
   * Angular / Capacitor origin used in mail deep links (verify + reset).
   */
  FRONTEND_URL: Env.schema.string({ format: 'url', tld: false }),

  /**
   * Capacitor deep-link return after Ally OAuth (e.g. fr.atasoif.app://auth/callback).
   * Declared optional for boot; Ally native handoff is a follow-up ticket.
   */
  NATIVE_OAUTH_RETURN_URL: Env.schema.string.optional(),

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
  | Trial UPCitemdb: no key (UPCITEMDB_USER_KEY optional / empty).
  | Paid /prod/v1 later: set USER_KEY (+ KEY_TYPE) for higher quota.
  |----------------------------------------------------------
  */
  OFF_API_BASE_URL: Env.schema.string({ format: 'url', tld: false }),
  OFF_USER_AGENT: Env.schema.string(),
  UPCITEMDB_ENABLED: Env.schema.boolean(),
  UPCITEMDB_API_BASE_URL: Env.schema.string({ format: 'url', tld: false }),
  UPCITEMDB_USER_KEY: Env.schema.string.optional(),
  UPCITEMDB_KEY_TYPE: Env.schema.string.optional(),
  /** Ace catalog:nurse daily remote budget (default 100 when unset). */
  CATALOG_NURSE_DAILY_LIMIT: Env.schema.number.optional(),

  /**
   * Catalog image mirror (OFF front photos → local disk, no CDN hotlink).
   * Used by `catalog:off-dump --mirror-images`. Optional until ops sets a path.
   */
  CATALOG_IMAGE_STORAGE_PATH: Env.schema.string.optional(),
  /** Optional public URL prefix for mirrored files (e.g. https://api…/media/catalog). */
  CATALOG_IMAGE_PUBLIC_BASE_URL: Env.schema.string.optional(),

  /**
   * Cellar uploads (shelf override + contributed catalog packshot).
   * Absolute path outside the release dir in production. Unset in tests uses a temp dir.
   */
  CELLAR_PHOTO_DIR: Env.schema.string.optional(),
  /**
   * Absolute max upload size in bytes (jpeg/png/webp/heic). Default 10485760 (10 MiB).
   * Files above CELLAR_PHOTO_SYNC_MAX_BYTES are queued for Sharp processing.
   */
  CELLAR_PHOTO_MAX_BYTES: Env.schema.number.optional(),
  /** Sync Sharp threshold. Default 2097152 (2 MiB). Larger → `@adonisjs/queue`. */
  CELLAR_PHOTO_SYNC_MAX_BYTES: Env.schema.number.optional(),
  /** Queue adapter: `sync` (default, inline) or `database` (+ `node ace queue:work`). */
  QUEUE_DRIVER: Env.schema.enum(['sync', 'database'] as const).optional(),

  /**
   * Shared secret for GET /api/v1/ops/kpis (header X-Ops-Token).
   * Empty or unset keeps the route closed. Not a user access token.
   */
  OPS_ADMIN_TOKEN: Env.schema.secret.optional(),
})
