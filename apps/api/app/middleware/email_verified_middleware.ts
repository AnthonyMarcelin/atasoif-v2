import type User from '#models/user'
import type { HttpContext } from '@adonisjs/core/http'
import type { NextFn } from '@adonisjs/core/types/http'

/**
 * Blocks authenticated app actions until the user has confirmed their email.
 * Pair with `middleware.auth()` — signup/login/verify/resend stay outside this gate.
 */
export default class EmailVerifiedMiddleware {
  async handle(ctx: HttpContext, next: NextFn) {
    const user = ctx.auth.getUserOrFail() as User

    if (!user.emailVerified) {
      return ctx.response.status(403).send({
        code: 'E_EMAIL_UNVERIFIED',
        message: 'Confirme ton e-mail pour continuer',
      })
    }

    return next()
  }
}
