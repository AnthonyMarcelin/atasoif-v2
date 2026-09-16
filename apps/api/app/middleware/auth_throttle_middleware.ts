import type { HttpContext } from '@adonisjs/core/http'
import type { NextFn } from '@adonisjs/core/types/http'
import app from '@adonisjs/core/services/app'

type ThrottleOptions = {
  /** Max attempts inside the window (default 20). */
  maxAttempts?: number
  /** Sliding window length in ms (default 15 minutes). */
  windowMs?: number
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

    const key = `${ctx.request.method()}:${ctx.request.url()}:${ctx.request.ip()}`
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
