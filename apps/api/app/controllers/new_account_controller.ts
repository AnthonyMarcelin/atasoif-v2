import User from '#models/user'
import AuthEmailTokenService from '#services/auth_email_token_service'
import VerifyEmailNotification from '#mails/verify_email_notification'
import { buildFrontendUrl } from '#services/frontend_url'
import { signupValidator } from '#validators/user'
import type { HttpContext } from '@adonisjs/core/http'
import mail from '@adonisjs/mail/services/main'
import UserTransformer from '#transformers/user_transformer'

export default class NewAccountController {
  async store({ request, serialize }: HttpContext) {
    const { fullName, email, password, pseudo } = await request.validateUsing(signupValidator)

    const user = await User.create({
      fullName: fullName ?? null,
      email,
      password,
      pseudo: pseudo ?? null,
      isPublic: false,
      emailVerified: false,
    })
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
