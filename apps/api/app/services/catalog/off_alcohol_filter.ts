/**
 * Open Food Facts alcohol category filter for dump / bulk import.
 * Prefer category tags; fall back to alcohol_100g when tags are thin.
 */

const INCLUDE_TAG_PREFIXES = [
  'en:alcoholic-beverages',
  'en:beers',
  'en:wines',
  'en:spirits',
  'en:whiskies',
  'en:whisky',
  'en:bourbons',
  'en:scotch-whiskies',
  'en:irish-whiskies',
  'en:rums',
  'en:rum',
  'en:gins',
  'en:vodkas',
  'en:cognacs',
  'en:armagnacs',
  'en:brandies',
  'en:liqueurs',
  'en:champagnes',
  'en:sparkling-wines',
  'en:ciders',
  'en:hard-ciders',
  'en:tequilas',
  'en:mezcal',
  'en:pastis',
  'en:anise-flavoured-drinks',
  'en:aperitifs',
  'en:digestifs',
  'en:bitters',
  'fr:bieres',
  'fr:bières',
  'fr:vins',
  'fr:spiritueux',
  'fr:whiskies',
  'fr:rhums',
  'fr:gins',
  'fr:vodkas',
  'fr:cognacs',
  'fr:liqueurs',
  'fr:champagnes',
  'fr:cidres',
  'fr:pastis',
] as const

const EXCLUDE_TAGS = new Set([
  'en:non-alcoholic-beers',
  'en:alcohol-free-beers',
  'en:dealcoholized-beers',
  'en:non-alcoholic-wines',
  'en:alcohol-free-wines',
  'en:non-alcoholic-beverages',
])

export type OffDumpProductLike = {
  code?: string | number | null
  product_name?: string | null
  product_name_fr?: string | null
  generic_name?: string | null
  brands?: string | null
  countries?: string | null
  countries_tags?: string[] | null
  origins?: string | null
  quantity?: string | null
  image_url?: string | null
  image_front_url?: string | null
  categories_tags?: string[] | null
  categories?: string | null
  nutriments?: Record<string, unknown> | null
  alcohol_100g?: number | string | null
}

/**
 * True when OFF category tags (or ABV signal) indicate an alcoholic beverage.
 */
export function isAlcoholicOffProduct(product: OffDumpProductLike): boolean {
  const tags = (product.categories_tags ?? []).map((tag) => tag.trim().toLowerCase())
  if (tags.some((tag) => EXCLUDE_TAGS.has(tag))) {
    return false
  }

  const included = tags.some((tag) =>
    INCLUDE_TAG_PREFIXES.some((prefix) => tag === prefix || tag.startsWith(`${prefix}-`))
  )

  if (included) {
    const abv = readAlcohol100g(product)
    if (abv !== null && abv <= 0) {
      return false
    }
    return true
  }

  // Thin tagging: accept only when ABV is clearly alcoholic.
  const abv = readAlcohol100g(product)
  return abv !== null && abv >= 0.5
}

export function readAlcohol100g(product: OffDumpProductLike): number | null {
  const raw =
    product.alcohol_100g ??
    product.nutriments?.alcohol ??
    product.nutriments?.['alcohol_100g'] ??
    null

  if (typeof raw === 'number' && Number.isFinite(raw)) {
    return raw
  }
  if (typeof raw === 'string') {
    const value = Number(raw.replace(',', '.'))
    return Number.isFinite(value) ? value : null
  }
  return null
}

export function listAlcoholIncludeTagPrefixes(): readonly string[] {
  return INCLUDE_TAG_PREFIXES
}
