import Bottle from '#models/bottle'

export type CatalogSearchParams = {
  q: string
  limit: number
  page: number
  category?: string
  recentDays?: number
}

/**
 * Local-only catalog typeahead (name / brand). Never calls remote providers.
 * Blank `q` with a category (or recentDays) browses instead of returning empty.
 */
export default class CatalogSearchService {
  async search({ q, limit, page, category, recentDays }: CatalogSearchParams) {
    const term = q.trim()
    const slug = category?.trim().toLowerCase() ?? ''

    // Debounced typeahead: blank query → empty page unless browsing a filter.
    if (term.length === 0 && !slug && !recentDays) {
      return Bottle.query()
        .whereNull('deleted_at')
        .whereRaw('1 = 0')
        .preload('category')
        .paginate(page, limit)
    }

    const query = Bottle.query().whereNull('deleted_at').preload('category')

    if (slug) {
      query.whereHas('category', (builder) => {
        builder.where('slug', slug)
      })
    }

    if (term.length > 0) {
      const like = `%${escapeLike(term)}%`
      query.where((builder) => {
        builder.whereILike('name', like).orWhereILike('brand', like)
      })
    }

    if (recentDays && recentDays > 0) {
      const since = new Date(Date.now() - recentDays * 24 * 60 * 60 * 1000)
      query.where('created_at', '>=', since).orderBy('created_at', 'desc')
    } else {
      query.orderBy('name', 'asc')
    }

    return query.paginate(page, limit)
  }
}

function escapeLike(value: string): string {
  return value.replace(/[\\%_]/g, '\\$&')
}
