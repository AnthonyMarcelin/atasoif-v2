import Bottle from '#models/bottle'

export type CatalogSearchParams = {
  q: string
  limit: number
  page: number
}

/**
 * Local-only catalog typeahead (name / brand). Never calls remote providers.
 */
export default class CatalogSearchService {
  async search({ q, limit, page }: CatalogSearchParams) {
    const term = q.trim()

    // Debounced typeahead: blank query → empty page (do not dump the catalog).
    if (term.length === 0) {
      return Bottle.query()
        .whereNull('deleted_at')
        .whereRaw('1 = 0')
        .preload('category')
        .paginate(page, limit)
    }

    const like = `%${escapeLike(term)}%`
    return Bottle.query()
      .whereNull('deleted_at')
      .preload('category')
      .where((builder) => {
        builder.whereILike('name', like).orWhereILike('brand', like)
      })
      .orderBy('name', 'asc')
      .paginate(page, limit)
  }
}

function escapeLike(value: string): string {
  return value.replace(/[\\%_]/g, '\\$&')
}
