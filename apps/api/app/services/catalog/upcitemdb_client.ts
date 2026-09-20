import { BOTTLE_SOURCES } from '@atasoif/shared'
import env from '#start/env'
import { mapCategorySlug } from '#services/catalog/map_category'
import { parseAbv, parseVolumeMl } from '#services/catalog/parse_quantity'
import type { CatalogProductDraft } from '#services/catalog/catalog_types'

type FetchLike = typeof fetch

type UpcItem = {
  ean?: string
  upc?: string
  title?: string
  brand?: string
  description?: string
  category?: string
  images?: string[]
  size?: string
  color?: string
}

type UpcLookupResponse = {
  code?: string
  total?: number
  items?: UpcItem[]
}

/**
 * UPCitemdb nurse client — EAN fallback when OFF misses.
 * Free Explorer (`/prod/trial`) needs no key; paid `/prod/v1` uses user_key.
 */
export default class UpcItemDbClient {
  constructor(private readonly fetchImpl: FetchLike = fetch) {}

  isEnabled(): boolean {
    return env.get('UPCITEMDB_ENABLED')
  }

  async lookupByBarcode(barcode: string): Promise<CatalogProductDraft | null> {
    if (!this.isEnabled()) {
      return null
    }

    const baseUrl = env.get('UPCITEMDB_API_BASE_URL')
    const url = new URL('/lookup', baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`)
    url.searchParams.set('upc', barcode)

    const headers: Record<string, string> = {
      Accept: 'application/json',
      'Content-Type': 'application/json',
    }

    const userKey = env.get('UPCITEMDB_USER_KEY')
    if (userKey) {
      headers.user_key = userKey
      headers.key_type = env.get('UPCITEMDB_KEY_TYPE') ?? '3scale'
    }

    const response = await this.fetchImpl(url, {
      method: 'GET',
      headers,
      signal: AbortSignal.timeout(8_000),
    })

    if (response.status === 404) {
      return null
    }

    if (!response.ok) {
      throw new Error(`UPCitemdb lookup failed with HTTP ${response.status}`)
    }

    const payload = (await response.json()) as UpcLookupResponse
    const item = payload.items?.[0]
    const title = item?.title?.trim()
    if (!item || !title) {
      return null
    }

    return this.mapItem(barcode, item, title, payload)
  }

  private mapItem(
    barcode: string,
    item: UpcItem,
    title: string,
    payload: UpcLookupResponse
  ): CatalogProductDraft {
    const code = String(item.ean || item.upc || barcode).trim()
    const brand = item.brand?.trim() || null
    const name = title
    const sizeText = item.size || item.description || null

    return {
      name,
      brand,
      origin: null,
      abv: parseAbv(item.description) ?? parseAbv(item.size),
      volumeMl: parseVolumeMl(sizeText),
      barcode: code,
      photoUrl: item.images?.[0] || null,
      categorySlug: mapCategorySlug([item.category, name, brand, item.description]),
      attrs: {
        provider: BOTTLE_SOURCES.upcitemdb,
        categoryRaw: item.category ?? null,
        sizeRaw: item.size ?? null,
      },
      source: BOTTLE_SOURCES.upcitemdb,
      externalId: code,
      raw: payload,
    }
  }
}
