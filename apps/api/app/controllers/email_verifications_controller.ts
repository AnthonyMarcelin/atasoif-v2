import User from '#models/user'
import type { HttpContext } from '@adonisjs/core/http'
import AuthTokenService from '#services/auth_token_service'
import AuthMailService from '#services/auth_mail_service'
import UserTransformer from '#transformers/user_transformer'
import { verifyEmailValidator } from '#validators/user'

export default class EmailVerificationsController {
  /**
   * Confirm email ownership with a purpose-bound encrypted token.
   */
  async store({ request, response, serialize }: HttpContext) {
    const { token } = await request.validateUsing(verifyEmailValidator)
    const tokens = new AuthTokenService()
    const payload = tokens.verifyEmailVerificationToken(token)

    if (!payload) {
      return response.badRequest({
        errors: [{ message: 'Lien de vérification invalide ou expiré' }],
      })
    }

    const user = await User.find(payload.userId)
    if (!user) {
      return response.badRequest({
        errors: [{ message: 'Lien de vérification invalide ou expiré' }],
      })
    }

    if (!user.emailVerified) {
      user.emailVerified = true
      await user.save()
    }

    return serialize(UserTransformer.transform(user))
  }

  /**
   * Resend verification email for the authenticated user.
   */
  async resend({ auth, response }: HttpContext) {
    const user = auth.getUserOrFail()

    if (user.emailVerified) {
      return response.ok({
        message: 'Ton email est déjà confirmé',
      })
    }

    await new AuthMailService().sendVerificationEmail(user)

    return {
      message: 'Email de confirmation renvoyé — jette un œil à ta boîte mail',
    }
  }
}
