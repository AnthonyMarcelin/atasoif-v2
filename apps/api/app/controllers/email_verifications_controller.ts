import User from '#models/user'
import AuthEmailTokenService from '#services/auth_email_token_service'
import { buildFrontendUrl } from '#services/frontend_url'
import VerifyEmailNotification from '#mails/verify_email_notification'
import { verifyEmailValidator } from '#validators/user'
import type { HttpContext } from '@adonisjs/core/http'
import mail from '@adonisjs/mail/services/main'
import UserTransformer from '#transformers/user_transformer'

export default class EmailVerificationsController {
  /**
   * Confirm email with a purpose-bound token from the verification mail.
   */
  async store({ request, response, serialize }: HttpContext) {
    const { token } = await request.validateUsing(verifyEmailValidator)
    const tokens = new AuthEmailTokenService()
    const payload = tokens.verifyEmailVerificationToken(token)

    if (!payload) {
      return response.status(400).send({
        errors: [{ message: 'Lien de vérification invalide ou expiré' }],
      })
    }

    const user = await User.find(payload.userId)
    if (!user) {
      return response.status(400).send({
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
    const user = auth.getUserOrFail() as User

    if (user.emailVerified) {
      return response.ok({
        message: 'Ton email est déjà confirmé',
      })
    }

    const tokens = new AuthEmailTokenService()
    const token = tokens.createEmailVerificationToken(user.id)
    const verifyUrl = buildFrontendUrl('/auth/verify-email', token)

    await mail.send(new VerifyEmailNotification(user, verifyUrl))

    return {
      message: 'Email de confirmation renvoyé · vérifie ta boîte mail',
    }
  }
}
