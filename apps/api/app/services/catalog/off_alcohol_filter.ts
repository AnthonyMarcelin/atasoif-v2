/**
 * Open Food Facts alcohol category filter for dump / bulk import.
 * Prefer category tags; fall back to alcohol_100g when tags are thin.
 *
 * Profiles:
 * - curated (default): whiskies, rums, gins, vodkas, beers + parent tags as needed
 * - full: broader alcoholic beverages (wine, cider, liqueurs, …)
 */

export type OffDumpFilterProfile = 'curated' | 'full'

/** Priority curated tags (Anthony / product stance: thousands of well-presented refs). */
const CURATED_TAG_PREFIXES = [
  'en:whiskies',
  'en:whisky',
  'en:bourbons',
  'en:scotch-whiskies',
  'en:irish-whiskies',
  'en:rums',
  'en:rum',
  'en:gins',
  'en:vodkas',
  'en:beers',
  'fr:whiskies',
  'fr:rhums',
  'fr:gins',
  'fr:vodkas',
  'fr:bieres',
  'fr:bières',
] as const

/** Parent tags accepted in curated mode when a child curated signal is present, or ABV is spirit/beer-like. */
const CURATED_PARENT_TAGS = [
  'en:alcoholic-beverages',
  'en:spirits',
  'fr:spiritueux',
] as const

const FULL_TAG_PREFIXES = [
  ...CURATED_TAG_PREFIXES,
  ...CURATED_PARENT_TAGS,
  'en:wines',
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
  'fr:vins',
  'fr:cognacs',
  'fr:liqueurs',
  'fr:champagnes',
  'fr:cidres',
  'fr:pastis',
] as const

const EXCLUDE_TAGS = new Set([
  'en:non-alcoholic-beverages',
  'en:non-alcoholic-beers',
  'en:alcohol-free-beers',
  'en:dealcoholized-beers',
  'en:non-alcoholic-wines',
  'en:alcohol-free-wines',
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

function tagMatchesPrefixes(tag: string, prefixes: readonly string[]): boolean {
  return prefixes.some((prefix) => tag === prefix || tag.startsWith(`${prefix}-`))
}

/**
 * True when OFF category tags (or ABV signal) indicate an alcoholic beverage
 * matching the selected import profile.
 */
export function isAlcoholicOffProduct(
  product: OffDumpProductLike,
  profile: OffDumpFilterProfile = 'curated'
): boolean {
  const tags = (product.categories_tags ?? []).map((tag) => tag.trim().toLowerCase())
  if (tags.some((tag) => EXCLUDE_TAGS.has(tag))) {
    return false
  }

  if (profile === 'full') {
    return matchesFullProfile(product, tags)
  }

  return matchesCuratedProfile(product, tags)
}

function matchesCuratedProfile(product: OffDumpProductLike, tags: string[]): boolean {
  const curatedHit = tags.some((tag) => tagMatchesPrefixes(tag, CURATED_TAG_PREFIXES))
  if (curatedHit) {
    return abvAllowsAlcohol(product)
  }

  const parentHit = tags.some((tag) => tagMatchesPrefixes(tag, CURATED_PARENT_TAGS))
  if (parentHit) {
    // Parent-only: keep spirit-strength SKUs or beer-range when name hints beer.
    const abv = readAlcohol100g(product)
    if (abv !== null && abv >= 15) {
      return true
    }
    const haystack = [
      product.product_name_fr,
      product.product_name,
      product.brands,
      product.categories,
      ...(product.categories_tags ?? []),
    ]
      .filter(Boolean)
      .join(' ')
      .toLowerCase()
    if (
      abv !== null &&
      abv >= 0.5 &&
      /\b(beer|bi[eè]re|lager|ale|stout|whisky|whiskey|rum|rhum|gin|vodka)\b/i.test(haystack)
    ) {
      return true
    }
  }

  return false
}

function matchesFullProfile(product: OffDumpProductLike, tags: string[]): boolean {
  const included = tags.some((tag) => tagMatchesPrefixes(tag, FULL_TAG_PREFIXES))
  if (included) {
    return abvAllowsAlcohol(product)
  }

  // Thin tagging: accept only when ABV is clearly alcoholic.
  const abv = readAlcohol100g(product)
  return abv !== null && abv >= 0.5
}

function abvAllowsAlcohol(product: OffDumpProductLike): boolean {
  const abv = readAlcohol100g(product)
  if (abv !== null && abv <= 0) {
    return false
  }
  return true
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

export function listCuratedIncludeTagPrefixes(): readonly string[] {
  return CURATED_TAG_PREFIXES
}

export function listFullIncludeTagPrefixes(): readonly string[] {
  return FULL_TAG_PREFIXES
}

/** @deprecated Prefer listCuratedIncludeTagPrefixes / listFullIncludeTagPrefixes */
export function listAlcoholIncludeTagPrefixes(): readonly string[] {
  return FULL_TAG_PREFIXES
}
