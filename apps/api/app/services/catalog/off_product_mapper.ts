import { BOTTLE_SOURCES } from '@atasoif/shared'
import { mapCategorySlug } from '#services/catalog/map_category'
import { parseAbv, parseVolumeMl } from '#services/catalog/parse_quantity'
import { cleanRetailName } from '#services/catalog/clean_retail_name'
import type { OffDumpProductLike } from '#services/catalog/off_alcohol_filter'
import type { CatalogProductDraft } from '#services/catalog/catalog_types'

export type OffProductPayload = {
  status?: number
  code?: string
  product?: OffDumpProductLike
}

/**
 * Map an OFF product object (live API or dump JSONL row) to a catalog draft.
 * Returns null when barcode/name are missing.
 */
export function mapOffProductToDraft(
  barcodeHint: string,
  product: OffDumpProductLike,
  raw: unknown = product
): CatalogProductDraft | null {
  const rawName =
    product.product_name_fr?.trim() ||
    product.product_name?.trim() ||
    product.generic_name?.trim() ||
    null

  if (!rawName) {
    return null
  }

  const nutriments = product.nutriments ?? {}
  const abv = parseAbv(nutriments.alcohol ?? nutriments['alcohol_100g'] ?? product.alcohol_100g ?? null)

  const code = String(product.code || barcodeHint).trim()
  if (!code) {
    return null
  }

  const brand = product.brands?.split(',')[0]?.trim() || null
  const name = cleanRetailName(rawName, brand)
  const origin =
    product.origins?.split(',')[0]?.trim() ||
    product.countries?.split(',')[0]?.trim() ||
    product.countries_tags?.[0]?.replace(/^en:/, '') ||
    null

  const remotePhoto = product.image_front_url || product.image_url || null

  return {
    name,
    brand,
    origin,
    abv,
    volumeMl: parseVolumeMl(product.quantity),
    barcode: code,
    photoUrl: remotePhoto,
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
      nameRaw: rawName,
      offImageUrl: remotePhoto,
    },
    source: BOTTLE_SOURCES.openfoodfacts,
    externalId: code,
    raw,
  }
}

/**
 * Map a live OFF API v2 payload (`status` + `product`) to a draft.
 */
export function mapOffApiPayloadToDraft(
  barcodeHint: string,
  payload: OffProductPayload
): CatalogProductDraft | null {
  if (payload.status !== 1 || !payload.product) {
    return null
  }
  return mapOffProductToDraft(barcodeHint, payload.product, payload)
}
