import User from '#models/user'
import AuthEmailTokenService from '#services/auth_email_token_service'
import MagicLinkNotification from '#mails/magic_link_notification'
import { buildFrontendUrl } from '#services/frontend_url'
import type { HttpContext } from '@adonisjs/core/http'
import mail from '@adonisjs/mail/services/main'
import vine from '@vinejs/vine'
import UserTransformer from '#transformers/user_transformer'

const requestValidator = vine.create({
  email: vine.string().trim().email().maxLength(254),
})

const consumeValidator = vine.create({
  token: vine.string().trim().minLength(10),
})

const GENERIC_RESPONSE = {
  message: 'Si un compte existe pour cet email, tu recevras un lien magique',
}

/**
 * Passwordless login alongside email/password (magic link stays additive).
 */
export default class MagicLinksController {
  async store({ request }: HttpContext) {
    const { email } = await request.validateUsing(requestValidator)
    const user = await User.findBy('email', email.trim().toLowerCase())

    if (user) {
      const tokens = new AuthEmailTokenService()
      const token = tokens.createMagicLinkToken(user.id, user.magicLinkVersion ?? 0)
      const magicUrl = buildFrontendUrl('/auth/magic-link', token)
      await mail.send(new MagicLinkNotification(user, magicUrl))
    }

    return GENERIC_RESPONSE
  }

  async update({ request, response }: HttpContext) {
    const { token } = await request.validateUsing(consumeValidator)
    const tokens = new AuthEmailTokenService()
    const payload = tokens.verifyMagicLinkToken(token)

    if (!payload) {
      return response.status(400).send({
        errors: [{ message: 'Lien magique invalide ou expiré' }],
      })
    }

    const user = await User.find(payload.userId)
    if (!user || (user.magicLinkVersion ?? 0) !== payload.version) {
      return response.status(400).send({
        errors: [{ message: 'Lien magique invalide ou expiré' }],
      })
    }

    user.magicLinkVersion = (user.magicLinkVersion ?? 0) + 1
    if (!user.emailVerified) {
      user.emailVerified = true
    }
    await user.save()

    const accessToken = await User.accessTokens.create(user)
    return {
      data: {
        type: 'bearer' as const,
        token: accessToken.value!.release(),
        user: new UserTransformer(user).toObject(),
      },
    }
  }
}
