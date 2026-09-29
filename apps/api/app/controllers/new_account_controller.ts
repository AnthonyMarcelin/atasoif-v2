import User from '#models/user'
import AuthEmailTokenService from '#services/auth_email_token_service'
import VerifyEmailNotification from '#mails/verify_email_notification'
import { buildFrontendUrl } from '#services/frontend_url'
import { signupValidator } from '#validators/user'
import type { HttpContext } from '@adonisjs/core/http'
import mail from '@adonisjs/mail/services/main'
import UserTransformer from '#transformers/user_transformer'

const SIGNUP_REJECTED = {
  errors: [
    {
      message:
        'Impossible de créer ce compte. Connecte-toi ou réinitialise ton mot de passe.',
    },
  ],
}

function isUniqueViolation(error: unknown): boolean {
  let current: unknown = error
  for (let i = 0; i < 4 && current; i++) {
    if (
      typeof current === 'object' &&
      current !== null &&
      'code' in current &&
      (current as { code?: string }).code === '23505'
    ) {
      return true
    }
    current =
      typeof current === 'object' && current !== null && 'cause' in current
        ? (current as { cause?: unknown }).cause
        : undefined
  }
  return false
}

export default class NewAccountController {
  async store({ request, response, serialize }: HttpContext) {
    const { fullName, email, password, pseudo } = await request.validateUsing(signupValidator)
    const normalizedEmail = email.trim().toLowerCase()

    // Avoid Vine unique-on-email so the API does not name the colliding field.
    const existing = await User.findBy('email', normalizedEmail)
    if (existing) {
      return response.status(422).send(SIGNUP_REJECTED)
    }

    let user: User
    try {
      user = await User.create({
        fullName: fullName ?? null,
        email: normalizedEmail,
        password,
        pseudo: pseudo ?? null,
        isPublic: false,
        emailVerified: false,
        passwordResetVersion: 0,
      })
    } catch (error) {
      if (isUniqueViolation(error)) {
        return response.status(422).send(SIGNUP_REJECTED)
      }
      throw error
    }

    const token = await User.accessTokens.create(user)

    const emailTokens = new AuthEmailTokenService()
    const verificationToken = emailTokens.createEmailVerificationToken(user.id)
    const verifyUrl = buildFrontendUrl('/auth/verify-email', verificationToken)
    await mail.send(new VerifyEmailNotification(user, verifyUrl))

    return serialize({
      user: UserTransformer.transform(user),
      type: 'bearer',
      token: token.value!.release(),
    })
  }
}
