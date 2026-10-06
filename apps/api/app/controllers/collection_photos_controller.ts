import { access } from 'node:fs/promises'
import type { HttpContext } from '@adonisjs/core/http'
import env from '#start/env'
import CollectionService from '#services/collection/collection_service'
import { CollectionError } from '#services/collection/collection_error'
import CellarPhotoStorage, { overridePhotoPath } from '#services/cellar_photo_storage'
import CatalogImageMirror from '#services/catalog/catalog_image_mirror'
import UserBottleTransformer from '#transformers/user_bottle_transformer'

const PHOTO_EXTNAMES = ['jpg', 'jpeg', 'png', 'webp', 'heic', 'heif']

export default class CollectionPhotosController {
  /**
   * Premium shelf photo. Free plans are rejected before the file is stored.
   * POST /api/v1/collection/bottles/:id/photo
   * ≤ CELLAR_PHOTO_SYNC_MAX_BYTES (default 2 MiB): sync Sharp/HEIC.
   * Heavier: 202 + queue job.
   */
  async store({ auth, params, request, response }: HttpContext) {
    const user = auth.getUserOrFail()
    const service = new CollectionService()
    const storage = new CellarPhotoStorage()

    try {
      const photo = request.file('photo', {
        size: storage.maxBytes(),
        extnames: PHOTO_EXTNAMES,
      })
      if (!photo) {
        throw new CollectionError(
          'E_PHOTO_INVALID',
          'Ajoute une photo jpeg, png, webp ou heic',
          422
        )
      }
      if (!photo.isValid) {
        throw new CollectionError('E_PHOTO_INVALID', 'Format ou taille de photo refusé', 422)
      }

      await service.assertUnlocked(user.id, Number(params.id))
      const { row, processing } = await service.saveShelfPhoto(user.id, Number(params.id), photo)
      const freemium = await service.freemiumPayload(user.id)
      const body = {
        data: new UserBottleTransformer(row).toObject({ locked: false }),
        meta: { freemium, photoProcessing: processing },
      }
      return processing ? response.accepted(body) : response.ok(body)
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
      await service.assertUnlocked(user.id, row.id)
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

  /**
   * Mirrored OFF dump front images (barcode filename). Auth required.
   * GET /api/v1/media/off/:name
   */
  async showOffCatalog({ params, response }: HttpContext) {
    const storageRoot = env.get('CATALOG_IMAGE_STORAGE_PATH')?.trim()
    if (!storageRoot) {
      return response.serviceUnavailable({
        code: 'E_PHOTO_STORAGE',
        message: 'Le stockage photo catalogue n’est pas configuré',
      })
    }

    const mirror = new CatalogImageMirror({
      storageRoot,
      userAgent: env.get('OFF_USER_AGENT'),
    })
    const absolutePath = mirror.resolveOffCatalogFile(String(params.name ?? ''))
    if (!absolutePath) {
      return response.notFound({
        code: 'E_PHOTO_NOT_FOUND',
        message: 'Photo introuvable',
      })
    }

    try {
      await access(absolutePath)
    } catch {
      return response.notFound({
        code: 'E_PHOTO_NOT_FOUND',
        message: 'Photo introuvable',
      })
    }

    const storage = new CellarPhotoStorage()
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
