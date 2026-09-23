import type { HttpContext } from '@adonisjs/core/http'
import type { MultipartFile } from '@adonisjs/core/bodyparser'
import CollectionService from '#services/collection/collection_service'
import { CollectionError } from '#services/collection/collection_error'
import CellarPhotoStorage from '#services/cellar_photo_storage'
import UserBottleTransformer from '#transformers/user_bottle_transformer'
import {
  createUserBottleValidator,
  listUserBottlesValidator,
  updateUserBottleValidator,
} from '#validators/user_bottle'

const PHOTO_EXTNAMES = ['jpg', 'jpeg', 'png', 'webp']

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
    const storage = new CellarPhotoStorage()
    const catalogPhoto = request.is(['multipart/form-data'])
      ? request.file('catalogPhoto', {
          size: storage.maxBytes(),
          extnames: PHOTO_EXTNAMES,
        })
      : null

    if (catalogPhoto) {
      return this.storeWithCatalogPhoto(auth, request, response, catalogPhoto, storage)
    }

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

  /**
   * Free users may attach a packshot when creating a missing catalog bottle.
   * The file becomes Bottle.photoUrl and photoStatus stays `pending`.
   */
  private async storeWithCatalogPhoto(
    auth: HttpContext['auth'],
    request: HttpContext['request'],
    response: HttpContext['response'],
    catalogPhoto: MultipartFile,
    storage: CellarPhotoStorage
  ) {
    const user = auth.getUserOrFail()
    let storedPath: string | null = null

    try {
      if (!catalogPhoto.isValid) {
        throw new CollectionError('E_PHOTO_INVALID', 'Format ou taille de photo refusé', 422)
      }

      const payload = await this.missPayloadFromMultipart(request)
      if (payload.bottleId || !payload.bottle) {
        throw new CollectionError(
          'E_INVALID_CREATE',
          'La photo catalogue s’ajoute en créant une fiche manquante',
          422
        )
      }

      const stored = await storage.storeCatalog(catalogPhoto)
      storedPath = stored.publicPath
      payload.bottle.photoUrl = stored.publicPath

      const service = new CollectionService()
      const row = await service.create(user.id, payload)
      const freemium = await service.freemiumPayload(user.id)
      return response.created({
        data: new UserBottleTransformer(row).toObject(),
        meta: { freemium },
      })
    } catch (error) {
      await storage.removeCatalogPublicPath(storedPath)
      return this.handleError(response, error)
    }
  }

  private async missPayloadFromMultipart(request: HttpContext['request']) {
    let bottle: unknown
    try {
      const raw = request.input('bottle')
      bottle = typeof raw === 'string' ? JSON.parse(raw) : raw
    } catch {
      throw new CollectionError('E_INVALID_CREATE', 'Fiche catalogue illisible', 422)
    }

    const data: Record<string, unknown> = {
      bottle,
      boughtAt: request.input('boughtAt'),
    }
    for (const key of [
      'bottleId',
      'pricePaid',
      'note',
      'review',
      'fillLevel',
      'photoUrlOverride',
      'nameOverride',
      'brandOverride',
      'originOverride',
      'abvOverride',
      'volumeMlOverride',
      'isPublic',
    ]) {
      const value = request.input(key)
      if (value !== undefined && value !== null && value !== '') {
        data[key] = value
      }
    }

    return createUserBottleValidator.validate(data)
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
