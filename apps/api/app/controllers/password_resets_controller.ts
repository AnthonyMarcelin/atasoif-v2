import User from '#models/user'
import AuthEmailTokenService from '#services/auth_email_token_service'
import PasswordResetNotification from '#mails/password_reset_notification'
import { buildFrontendUrl } from '#services/frontend_url'
import { forgotPasswordValidator, resetPasswordValidator } from '#validators/user'
import type { HttpContext } from '@adonisjs/core/http'
import mail from '@adonisjs/mail/services/main'

const FORGOT_PASSWORD_RESPONSE = {
  message:
    'Si un compte existe pour cet email, tu recevras un lien pour réinitialiser ton mot de passe',
}

const INVALID_RESET = {
  errors: [{ message: 'Lien de réinitialisation invalide ou expiré' }],
}

export default class PasswordResetsController {
  /**
   * Request a password-reset email. Always returns the same message
   * to avoid account enumeration.
   * Rotates `passwordResetVersion` so previous reset links stop working.
   */
  async store({ request }: HttpContext) {
    const { email } = await request.validateUsing(forgotPasswordValidator)
    const user = await User.findBy('email', email.trim().toLowerCase())

    if (user) {
      user.passwordResetVersion = (user.passwordResetVersion ?? 0) + 1
      await user.save()

      const tokens = new AuthEmailTokenService()
      const token = tokens.createPasswordResetToken(user.id, user.passwordResetVersion)
      const resetUrl = buildFrontendUrl('/auth/reset-password', token)
      await mail.send(new PasswordResetNotification(user, resetUrl))
    }

    return FORGOT_PASSWORD_RESPONSE
  }

  /**
   * Reset password using a purpose-bound + versioned token, then revoke all access tokens.
   * Consumes the token by bumping `passwordResetVersion` again.
   */
  async update({ request, response }: HttpContext) {
    const { token, password } = await request.validateUsing(resetPasswordValidator)
    const tokens = new AuthEmailTokenService()
    const payload = tokens.verifyPasswordResetToken(token)

    if (!payload) {
      return response.status(400).send(INVALID_RESET)
    }

    const user = await User.find(payload.userId)
    if (!user || user.passwordResetVersion !== payload.version) {
      return response.status(400).send(INVALID_RESET)
    }

    user.password = password
    user.passwordResetVersion = user.passwordResetVersion + 1
    await user.save()
    await User.accessTokens.deleteAll(user)

    return {
      message: 'Mot de passe mis à jour · reconnecte-toi',
    }
  }
}
