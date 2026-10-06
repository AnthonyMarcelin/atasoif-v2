import type { HttpContext } from '@adonisjs/core/http'
import vine from '@vinejs/vine'
import FriendsService, { FriendsError } from '#services/friends_service'
import { buildShareInviteUrl } from '#services/frontend_url'

const inviteValidator = vine.create({
  target: vine.string().trim().minLength(2).maxLength(255),
})

const respondValidator = vine.create({
  accept: vine.boolean(),
})

const shareValidator = vine.create({
  shareCellarWithFriends: vine.boolean().optional(),
  sharePrices: vine.boolean().optional(),
  shareNotes: vine.boolean().optional(),
  findableByPseudo: vine.boolean().optional(),
})

export default class FriendsController {
  async index({ auth }: HttpContext) {
    const user = auth.getUserOrFail()
    const service = new FriendsService()
    const inviteCode = await service.ensureInviteCode(user)
    const lists = await service.listFor(user.id)
    return {
      data: {
        inviteCode,
        inviteUrl: buildShareInviteUrl(inviteCode),
        ...lists,
      },
    }
  }

  async store({ auth, request, response }: HttpContext) {
    const user = auth.getUserOrFail()
    const { target } = await request.validateUsing(inviteValidator)
    try {
      const row = await new FriendsService().invite(user.id, target)
      return response.created({ data: { id: row.id, status: row.status } })
    } catch (error) {
      return this.handleError(response, error)
    }
  }

  async respond({ auth, params, request, response }: HttpContext) {
    const user = auth.getUserOrFail()
    const { accept } = await request.validateUsing(respondValidator)
    try {
      const row = await new FriendsService().respond(user.id, Number(params.id), accept)
      return { data: row ? { id: row.id, status: row.status } : { deleted: true } }
    } catch (error) {
      return this.handleError(response, error)
    }
  }

  async shareShow({ auth }: HttpContext) {
    const user = auth.getUserOrFail()
    return { data: await new FriendsService().shareSettings(user.id) }
  }

  async shareUpdate({ auth, request, response }: HttpContext) {
    const user = auth.getUserOrFail()
    const patch = await request.validateUsing(shareValidator)
    try {
      return { data: await new FriendsService().updateShareSettings(user.id, patch) }
    } catch (error) {
      return this.handleError(response, error)
    }
  }

  async unblock({ auth, params, response }: HttpContext) {
    const user = auth.getUserOrFail()
    try {
      await new FriendsService().unblock(user.id, Number(params.id))
      return { data: { deleted: true } }
    } catch (error) {
      return this.handleError(response, error)
    }
  }

  private handleError(response: HttpContext['response'], error: unknown) {
    if (error instanceof FriendsError) {
      return response.status(error.status).send({
        code: error.code,
        message: error.message,
      })
    }
    throw error
  }
}
