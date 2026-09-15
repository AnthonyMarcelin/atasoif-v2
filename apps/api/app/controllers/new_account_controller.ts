import User from '#models/user'
import { signupValidator } from '#validators/user'
import type { HttpContext } from '@adonisjs/core/http'
import UserTransformer from '#transformers/user_transformer'
import AuthMailService from '#services/auth_mail_service'

export default class NewAccountController {
  async store({ request, serialize }: HttpContext) {
    const { fullName, email, password } = await request.validateUsing(signupValidator)

    const user = await User.create({
      fullName: fullName ?? null,
      email,
      password,
      pseudo: null,
      isPublic: false,
      emailVerified: false,
    })
    const token = await User.accessTokens.create(user)

    await new AuthMailService().sendVerificationEmail(user)

    return serialize({
      user: UserTransformer.transform(user),
      type: 'bearer',
      token: token.value!.release(),
    })
  }
}
