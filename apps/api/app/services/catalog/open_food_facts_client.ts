import { BOTTLE_SOURCES } from '@atasoif/shared'
import env from '#start/env'
import { mapCategorySlug } from '#services/catalog/map_category'
import { parseAbv, parseVolumeMl } from '#services/catalog/parse_quantity'
import type { CatalogProductDraft } from '#services/catalog/catalog_types'

type FetchLike = typeof fetch

type OffProductResponse = {
  status?: number
  code?: string
  product?: {
    code?: string
    product_name?: string
    product_name_fr?: string
    generic_name?: string
    brands?: string
    countries?: string
    countries_tags?: string[]
    origins?: string
    quantity?: string
    image_url?: string
    image_front_url?: string
    categories_tags?: string[]
    categories?: string
    nutriments?: Record<string, unknown>
    alcohol_100g?: number | string
  }
}

const OFF_FIELDS = [
  'code',
  'product_name',
  'product_name_fr',
  'generic_name',
  'brands',
  'countries',
  'countries_tags',
  'origins',
  'quantity',
  'image_url',
  'image_front_url',
  'categories_tags',
  'categories',
  'nutriments',
  'alcohol_100g',
].join(',')

/**
 * Open Food Facts product-by-barcode client (live miss only — not typeahead).
 */
export default class OpenFoodFactsClient {
  constructor(private readonly fetchImpl: FetchLike = fetch) {}

  async lookupByBarcode(barcode: string): Promise<CatalogProductDraft | null> {
    const baseUrl = env.get('OFF_API_BASE_URL')
    const userAgent = env.get('OFF_USER_AGENT')
    const url = new URL(`/api/v2/product/${encodeURIComponent(barcode)}.json`, baseUrl)
    url.searchParams.set('fields', OFF_FIELDS)

    const response = await this.fetchImpl(url, {
      method: 'GET',
      headers: {
        Accept: 'application/json',
        'User-Agent': userAgent,
      },
      signal: AbortSignal.timeout(8_000),
    })

    if (response.status === 404) {
      return null
    }

    if (!response.ok) {
      throw new Error(`OFF lookup failed with HTTP ${response.status}`)
    }

    const payload = (await response.json()) as OffProductResponse
    if (payload.status !== 1 || !payload.product) {
      return null
    }

    return this.mapProduct(barcode, payload)
  }

  private mapProduct(barcode: string, payload: OffProductResponse): CatalogProductDraft | null {
    const product = payload.product
    if (!product) {
      return null
    }

    const name =
      product.product_name_fr?.trim() ||
      product.product_name?.trim() ||
      product.generic_name?.trim() ||
      null

    if (!name) {
      return null
    }

    const nutriments = product.nutriments ?? {}
    const abv = parseAbv(
      nutriments.alcohol ?? nutriments['alcohol_100g'] ?? product.alcohol_100g ?? null
    )

    const code = String(payload.code || product.code || barcode).trim()
    const brand = product.brands?.split(',')[0]?.trim() || null
    const origin =
      product.origins?.split(',')[0]?.trim() ||
      product.countries?.split(',')[0]?.trim() ||
      product.countries_tags?.[0]?.replace(/^en:/, '') ||
      null

    return {
      name,
      brand,
      origin,
      abv,
      volumeMl: parseVolumeMl(product.quantity),
      barcode: code,
      photoUrl: product.image_front_url || product.image_url || null,
      categorySlug: mapCategorySlug([
        ...(product.categories_tags ?? []),
        product.categories,
        name,
        brand,
      ]),
      attrs: {
        provider: BOTTLE_SOURCES.openfoodfacts,
        categoriesTags: product.categories_tags ?? [],
        quantityRaw: product.quantity ?? null,
      },
      source: BOTTLE_SOURCES.openfoodfacts,
      externalId: code,
      raw: payload,
    }
  }
}
