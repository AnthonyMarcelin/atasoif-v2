import type { HttpContext } from '@adonisjs/core/http'
import type { NextFn } from '@adonisjs/core/types/http'
import app from '@adonisjs/core/services/app'

type ThrottleOptions = {
  /** Max attempts inside the window (default 20). */
  maxAttempts?: number
  /** Sliding window length in ms (default 15 minutes). */
  windowMs?: number
  /**
   * Stable bucket id. Required when the path varies (barcode, bottle id).
   * Without it, each URL would get its own window and the limit would not hold.
   */
  bucket?: string
}

/**
 * One window per route bucket, not per query string or path parameter.
 * Authenticated callers share a bucket by user id so a NAT does not collide.
 */
export function throttleStorageKey(input: {
  method: string
  scope: string
  ip: string
  userId?: number | null
}): string {
  const actor = input.userId ? `user:${input.userId}` : `ip:${input.ip}`
  return `${input.method}:${input.scope}:${actor}`
}

export function throttleScope(input: { bucket?: string; url: string }): string {
  if (input.bucket && input.bucket.trim().length > 0) {
    return input.bucket.trim()
  }
  const pathOnly = input.url.split('?')[0]
  return pathOnly && pathOnly.length > 0 ? pathOnly : input.url
}

type Bucket = {
  count: number
  resetAt: number
}

/**
 * In-memory IP throttle for auth endpoints (single VPS).
 * Disabled in tests. Multi-instance / Redis can replace this later via @adonisjs/limiter.
 */
const buckets = new Map<string, Bucket>()

function pruneExpired(now: number) {
  if (buckets.size < 500) {
    return
  }
  for (const [key, bucket] of buckets) {
    if (bucket.resetAt <= now) {
      buckets.delete(key)
    }
  }
}

export default class AuthThrottleMiddleware {
  async handle(ctx: HttpContext, next: NextFn, options: ThrottleOptions = {}) {
    if (app.inTest) {
      return next()
    }

    const maxAttempts = options.maxAttempts ?? 20
    const windowMs = options.windowMs ?? 15 * 60 * 1000
    const now = Date.now()
    pruneExpired(now)

    const authUser = ctx.auth.user as { id?: number } | undefined
    const userId = typeof authUser?.id === 'number' ? authUser.id : null
    const key = throttleStorageKey({
      method: ctx.request.method(),
      scope: throttleScope({ bucket: options.bucket, url: ctx.request.url() }),
      ip: ctx.request.ip(),
      userId,
    })
    let bucket = buckets.get(key)

    if (!bucket || bucket.resetAt <= now) {
      bucket = { count: 0, resetAt: now + windowMs }
      buckets.set(key, bucket)
    }

    bucket.count += 1

    if (bucket.count > maxAttempts) {
      const retryAfterSec = Math.max(1, Math.ceil((bucket.resetAt - now) / 1000))
      ctx.response.header('Retry-After', String(retryAfterSec))
      return ctx.response.status(429).send({
        code: 'E_TOO_MANY_REQUESTS',
        message: 'Trop de tentatives. Réessaie dans un moment.',
      })
    }

    return next()
  }
}
