import type { HttpContext } from '@adonisjs/core/http'
import CollectionService, { CollectionError } from '#services/collection/collection_service'
import UserBottleTransformer from '#transformers/user_bottle_transformer'
import {
  createUserBottleValidator,
  listUserBottlesValidator,
  updateUserBottleValidator,
} from '#validators/user_bottle'

export default class CollectionBottlesController {
  /**
   * List personal collection with optional category filter.
   * GET /api/v1/collection/bottles?category=&categoryId=&limit=&page=
   */
  async index({ auth, request, response }: HttpContext) {
    const user = auth.getUserOrFail()
    const filters = await request.validateUsing(listUserBottlesValidator)
    const service = new CollectionService()
    const paginator = await service.list(user.id, filters)
    const freemium = await service.freemiumPayload(user.id)

    return response.ok({
      data: paginator.all().map((row) => new UserBottleTransformer(row).toObject()),
      meta: {
        ...paginator.getMeta(),
        freemium,
      },
    })
  }

  /**
   * Show one owned cellar entry.
   * GET /api/v1/collection/bottles/:id
   */
  async show({ auth, params, response }: HttpContext) {
    const user = auth.getUserOrFail()
    const service = new CollectionService()

    try {
      const row = await service.findOwned(user.id, Number(params.id))
      const freemium = await service.freemiumPayload(user.id)
      return response.ok({
        data: new UserBottleTransformer(row).toObject(),
        meta: { freemium },
      })
    } catch (error) {
      return this.handleError(response, error)
    }
  }

  /**
   * Add from catalog hit (`bottleId`) or miss (`bottle` creates catalog row + entry).
   * POST /api/v1/collection/bottles
   */
  async store({ auth, request, response }: HttpContext) {
    const user = auth.getUserOrFail()
    const payload = await request.validateUsing(createUserBottleValidator)
    const service = new CollectionService()

    try {
      const row = await service.create(user.id, payload)
      const freemium = await service.freemiumPayload(user.id)
      return response.created({
        data: new UserBottleTransformer(row).toObject(),
        meta: { freemium },
      })
    } catch (error) {
      return this.handleError(response, error)
    }
  }

  /**
   * Update memory overrides / premium fields on an owned entry.
   * PATCH /api/v1/collection/bottles/:id
   */
  async update({ auth, params, request, response }: HttpContext) {
    const user = auth.getUserOrFail()
    const payload = await request.validateUsing(updateUserBottleValidator)
    const service = new CollectionService()

    try {
      const row = await service.update(user.id, Number(params.id), payload)
      const freemium = await service.freemiumPayload(user.id)
      return response.ok({
        data: new UserBottleTransformer(row).toObject(),
        meta: { freemium },
      })
    } catch (error) {
      return this.handleError(response, error)
    }
  }

  /**
   * Delete an owned cellar entry.
   * DELETE /api/v1/collection/bottles/:id
   */
  async destroy({ auth, params, response }: HttpContext) {
    const user = auth.getUserOrFail()
    const service = new CollectionService()

    try {
      await service.delete(user.id, Number(params.id))
      const freemium = await service.freemiumPayload(user.id)
      return response.ok({
        data: { id: Number(params.id), deleted: true },
        meta: { freemium },
      })
    } catch (error) {
      return this.handleError(response, error)
    }
  }

  private handleError(response: HttpContext['response'], error: unknown) {
    if (error instanceof CollectionError) {
      return response.status(error.status).send({
        code: error.code,
        message: error.message,
        ...error.extras,
      })
    }
    throw error
  }
}
