import type { HttpContext } from '@adonisjs/core/http'
import Category from '#models/category'

/**
 * Seeded alcohol categories for add-flow miss (categoryId on create).
 * GET /api/v1/catalog/categories
 */
export default class CatalogCategoriesController {
  async index({ response }: HttpContext) {
    const rows = await Category.query().orderBy('name', 'asc')
    return response.ok({
      data: rows.map((row) => ({
        id: row.id,
        slug: row.slug,
        name: row.name,
      })),
    })
  }
}
