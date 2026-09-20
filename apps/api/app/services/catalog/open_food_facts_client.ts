import env from '#start/env'
import { mapOffApiPayloadToDraft, type OffProductPayload } from '#services/catalog/off_product_mapper'
import type { CatalogProductDraft } from '#services/catalog/catalog_types'

type FetchLike = typeof fetch

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

    const payload = (await response.json()) as OffProductPayload
    return mapOffApiPayloadToDraft(barcode, payload)
  }
}
