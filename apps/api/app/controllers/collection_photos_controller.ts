import type { HttpContext } from '@adonisjs/core/http'
import CollectionService from '#services/collection/collection_service'
import { CollectionError } from '#services/collection/collection_error'
import CellarPhotoStorage, { overridePhotoPath } from '#services/cellar_photo_storage'
import UserBottleTransformer from '#transformers/user_bottle_transformer'

const PHOTO_EXTNAMES = ['jpg', 'jpeg', 'png', 'webp']

export default class CollectionPhotosController {
  /**
   * Premium shelf photo. Free plans are rejected before the file is stored.
   * POST /api/v1/collection/bottles/:id/photo
   */
  async store({ auth, params, request, response }: HttpContext) {
    const user = auth.getUserOrFail()
    const service = new CollectionService()
    const storage = new CellarPhotoStorage()

    try {
      const row = await service.preparePhotoOverride(user.id, Number(params.id))
      const photo = request.file('photo', {
        size: storage.maxBytes(),
        extnames: PHOTO_EXTNAMES,
      })
      if (!photo) {
        throw new CollectionError('E_PHOTO_INVALID', 'Ajoute une photo jpeg, png ou webp', 422)
      }
      if (!photo.isValid) {
        throw new CollectionError('E_PHOTO_INVALID', 'Format ou taille de photo refusé', 422)
      }

      const stored = await storage.storeOverride(user.id, row.id, photo)
      row.photoUrlOverride = stored.publicPath
      try {
        await row.save()
      } catch (error) {
        await storage.deleteOverride(user.id, row.id)
        throw error
      }

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
   * Owner-only bytes for a shelf photo stored on local disk.
   * GET /api/v1/collection/bottles/:id/photo
   */
  async show({ auth, params, response }: HttpContext) {
    const user = auth.getUserOrFail()
    const service = new CollectionService()
    const storage = new CellarPhotoStorage()

    try {
      const row = await service.findOwned(user.id, Number(params.id))
      if (row.photoUrlOverride !== overridePhotoPath(row.id)) {
        throw new CollectionError('E_PHOTO_NOT_FOUND', 'Photo introuvable', 404)
      }
      const absolutePath = await storage.findOverrideFile(user.id, row.id)
      if (!absolutePath) {
        throw new CollectionError('E_PHOTO_NOT_FOUND', 'Photo introuvable', 404)
      }
      this.streamImage(response, storage, absolutePath)
    } catch (error) {
      return this.handleError(response, error)
    }
  }

  /**
   * Shared catalog packshot contributed on a miss. Auth required, not owner-only.
   * GET /api/v1/media/catalog/:name
   */
  async showCatalog({ params, response }: HttpContext) {
    const storage = new CellarPhotoStorage()
    const absolutePath = storage.resolveCatalogFile(String(params.name ?? ''))
    if (!absolutePath) {
      return response.notFound({
        code: 'E_PHOTO_NOT_FOUND',
        message: 'Photo introuvable',
      })
    }
    this.streamImage(response, storage, absolutePath)
  }

  private streamImage(
    response: HttpContext['response'],
    storage: CellarPhotoStorage,
    absolutePath: string
  ) {
    response.header('Content-Type', storage.contentTypeFor(absolutePath))
    response.header('X-Content-Type-Options', 'nosniff')
    response.header('Content-Disposition', 'inline')
    response.header('Cache-Control', 'private, no-store')
    response.stream(storage.openReadStream(absolutePath))
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
