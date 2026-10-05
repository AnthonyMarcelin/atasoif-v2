import { timingSafeEqual } from 'node:crypto'
import type { HttpContext } from '@adonisjs/core/http'
import env from '#start/env'
import vine from '@vinejs/vine'

const MAX_SECRET_LENGTH = 256

const storeReviewValidator = vine.create({
  secret: vine.string().trim().minLength(1).maxLength(MAX_SECRET_LENGTH),
})

type Releasable = { release: () => string }

function configuredSecret(): string | undefined {
  const value = env.get('STORE_REVIEW_SECRET') as string | Releasable | undefined
  if (!value) {
    return undefined
  }

  const raw = typeof value === 'string' ? value : value.release()
  const trimmed = raw.trim()
  return trimmed.length > 0 ? trimmed : undefined
}

function secretsMatch(expected: string, provided: string): boolean {
  const expectedBuffer = Buffer.from(expected)
  const providedBuffer = Buffer.from(provided)
  if (expectedBuffer.length !== providedBuffer.length) {
    return false
  }

  return timingSafeEqual(expectedBuffer, providedBuffer)
}

/**
 * App Store / TestFlight review bypass: compare the submitted secret to
 * `STORE_REVIEW_SECRET` (Dokploy API env). Never embed the secret in the web build.
 */
export default class StoreReviewController {
  async store({ request, response }: HttpContext) {
    const { secret } = await request.validateUsing(storeReviewValidator)
    const expected = configuredSecret()

    if (!expected || !secretsMatch(expected, secret)) {
      return response.status(401).send({
        code: 'E_STORE_REVIEW_UNAUTHORIZED',
        message: 'Code revue invalide',
      })
    }

    return { ok: true }
  }
}
