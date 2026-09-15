import User from '#models/user'
import { loginValidator } from '#validators/user'
import type { HttpContext } from '@adonisjs/core/http'
import UserTransformer from '#transformers/user_transformer'

export default class AccessTokensController {
  async store({ request, serialize }: HttpContext) {
    const { email, password } = await request.validateUsing(loginValidator)

    const user = await User.verifyCredentials(email, password)
    const token = await User.accessTokens.create(user)

    return serialize({
      user: UserTransformer.transform(user),
      type: 'bearer',
      token: token.value!.release(),
    })
  }

  async destroy({ auth }: HttpContext) {
    await auth.use('api').invalidateToken()

    return {
      message: 'Déconnexion réussie',
    }
  }
}
