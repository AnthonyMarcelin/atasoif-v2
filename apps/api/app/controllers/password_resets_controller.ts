import User from '#models/user'
import { safeTiming } from '@adonisjs/core/helpers'
import type { HttpContext } from '@adonisjs/core/http'
import AuthTokenService from '#services/auth_token_service'
import AuthMailService from '#services/auth_mail_service'
import { forgotPasswordValidator, resetPasswordValidator } from '#validators/user'

const FORGOT_PASSWORD_MESSAGE =
  'Si un compte existe pour cet email, tu recevras un lien pour réinitialiser ton mot de passe.'

export default class PasswordResetsController {
  /**
   * Request a password-reset email. Always returns the same message (anti-enumeration).
   */
  async store({ request }: HttpContext) {
    const { email } = await request.validateUsing(forgotPasswordValidator)

    return safeTiming(200, async () => {
      const user = await User.findBy('email', email)
      if (user) {
        await new AuthMailService().sendPasswordResetEmail(user)
      }

      return { message: FORGOT_PASSWORD_MESSAGE }
    })
  }

  /**
   * Apply a new password using a purpose-bound reset token, then revoke all sessions.
   */
  async update({ request, response }: HttpContext) {
    const { token, password } = await request.validateUsing(resetPasswordValidator)
    const tokens = new AuthTokenService()
    const payload = tokens.verifyPasswordResetToken(token)

    if (!payload) {
      return response.badRequest({
        errors: [{ message: 'Lien de réinitialisation invalide ou expiré' }],
      })
    }

    const user = await User.find(payload.userId)
    if (!user) {
      return response.badRequest({
        errors: [{ message: 'Lien de réinitialisation invalide ou expiré' }],
      })
    }

    user.password = password
    await user.save()
    await User.accessTokens.deleteAll(user)

    return {
      message: 'Mot de passe mis à jour — reconnecte-toi',
    }
  }
}
