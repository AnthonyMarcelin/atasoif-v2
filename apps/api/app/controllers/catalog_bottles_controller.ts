import type { HttpContext } from '@adonisjs/core/http'
import Bottle from '#models/bottle'
import BottleTransformer from '#transformers/bottle_transformer'
import CatalogSearchService from '#services/catalog/catalog_search_service'
import CatalogLookupService from '#services/catalog/catalog_lookup_service'
import { catalogBarcodeValidator, catalogSearchValidator } from '#validators/catalog'

export default class CatalogBottlesController {
  /**
   * Local catalog search by name / brand (no remote providers).
   * GET /api/v1/catalog/bottles?q=&limit=&page=
   */
  async index({ request, serialize }: HttpContext) {
    const {
      q = '',
      limit = 20,
      page = 1,
      category,
      recentDays,
    } = await request.validateUsing(catalogSearchValidator)

    const paginator = await new CatalogSearchService().search({
      q,
      limit,
      page,
      category,
      recentDays,
    })
    return serialize(BottleTransformer.transform(paginator))
  }

  /**
   * Prefill for add-flow when opening `/cave/ajouter?bottleId=`.
   * GET /api/v1/catalog/bottles/:id
   */
  async show({ params, response }: HttpContext) {
    const id = Number(params.id)
    if (!Number.isInteger(id) || id < 1) {
      return response.status(404).send({
        code: 'E_BOTTLE_NOT_FOUND',
        message: 'Bouteille introuvable',
      })
    }

    const bottle = await Bottle.query()
      .where('id', id)
      .whereNull('deleted_at')
      .preload('category')
      .first()

    if (!bottle) {
      return response.status(404).send({
        code: 'E_BOTTLE_NOT_FOUND',
        message: 'Bouteille introuvable',
      })
    }

    return response.ok({ data: new BottleTransformer(bottle).toObject() })
  }

  /**
   * Cache-first barcode lookup: local → OFF → UPCitemdb → upsert.
   * GET /api/v1/catalog/bottles/barcode/:barcode
   */
  async showByBarcode({ params, request, response }: HttpContext) {
    const { barcode } = await request.validateUsing(catalogBarcodeValidator, {
      data: { barcode: String(params.barcode ?? '') },
    })

    const result = await new CatalogLookupService().lookupByBarcode(barcode)
    if (!result) {
      return response.status(404).send({
        code: 'E_BOTTLE_NOT_FOUND',
        message: 'Aucune bouteille trouvée pour ce code-barres',
      })
    }

    return response.ok({
      data: {
        ...new BottleTransformer(result.bottle).toObject(),
        lookupOrigin: result.origin,
      },
    })
  }
}
