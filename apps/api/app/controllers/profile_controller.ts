import UserTransformer from '#transformers/user_transformer'
import { updateProfileValidator } from '#validators/user'
import type { HttpContext } from '@adonisjs/core/http'

export default class ProfileController {
  async show({ auth, serialize }: HttpContext) {
    return serialize(UserTransformer.transform(auth.getUserOrFail()))
  }

  /**
   * Update display pseudo and public visibility for the authenticated user.
   */
  async update({ auth, request, serialize }: HttpContext) {
    const user = auth.getUserOrFail()
    const { pseudo, isPublic } = await request.validateUsing(updateProfileValidator, {
      meta: { userId: user.id },
    })

    user.pseudo = pseudo
    user.isPublic = isPublic
    await user.save()

    return serialize(UserTransformer.transform(user))
  }
}
