import { timingSafeEqual } from 'node:crypto'
import type { HttpContext } from '@adonisjs/core/http'
import type { NextFn } from '@adonisjs/core/types/http'
import env from '#start/env'

/** Header for the ops KPI read API. User access tokens are not accepted. */
export const OPS_TOKEN_HEADER = 'X-Ops-Token'

const MAX_TOKEN_LENGTH = 256

type Releasable = { release: () => string }

function configuredToken(): string | undefined {
  const value = env.get('OPS_ADMIN_TOKEN') as string | Releasable | undefined
  if (!value) {
    return undefined
  }

  const raw = typeof value === 'string' ? value : value.release()
  const trimmed = raw.trim()
  return trimmed.length > 0 ? trimmed : undefined
}

function tokensMatch(expected: string, provided: string): boolean {
  const expectedBuffer = Buffer.from(expected)
  const providedBuffer = Buffer.from(provided)
  if (expectedBuffer.length !== providedBuffer.length) {
    return false
  }

  return timingSafeEqual(expectedBuffer, providedBuffer)
}

/**
 * Closes ops routes unless `OPS_ADMIN_TOKEN` is set and `X-Ops-Token` matches.
 * Missing config fails closed with the same 401 as a bad token (no config leak).
 */
export default class OpsTokenMiddleware {
  async handle(ctx: HttpContext, next: NextFn) {
    const expected = configuredToken()
    const provided = ctx.request.header(OPS_TOKEN_HEADER)?.trim() ?? ''

    if (
      !expected ||
      provided.length === 0 ||
      provided.length > MAX_TOKEN_LENGTH ||
      !tokensMatch(expected, provided)
    ) {
      return ctx.response.status(401).send({
        code: 'E_OPS_UNAUTHORIZED',
        message: 'Accès ops refusé',
      })
    }

    return next()
  }
}
