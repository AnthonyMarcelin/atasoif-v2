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
  'en:mezcals',
  'en:pastis',
  'en:anise-flavoured-drinks',
  'en:aperitifs',
  'en:digestifs',
  'en:bitters',
  'en:saké',
  'en:sake',
  'en:soju',
  'fr:vins',
  'fr:cognacs',
  'fr:liqueurs',
  'fr:champagnes',
  'fr:cidres',
  'fr:pastis',
  'fr:tequilas',
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
  /** Array from OFF JSONL; string / CSV / JSON-array string from DuckDB CSV exports. */
  countries_tags?: string[] | string | null
  origins?: string | null
  quantity?: string | null
  image_url?: string | null
  image_front_url?: string | null
  /** Array from OFF JSONL; string / CSV / JSON-array string from DuckDB CSV exports. */
  categories_tags?: string[] | string | null
  categories?: string | null
  nutriments?: Record<string, unknown> | null
  alcohol_100g?: number | string | null
}

function tagMatchesPrefixes(tag: string, prefixes: readonly string[]): boolean {
  return prefixes.some((prefix) => tag === prefix || tag.startsWith(`${prefix}-`))
}

/**
 * Normalize OFF tag fields to a lowercase string[].
 * DuckDB JSON export and CSV dumps often emit a comma-separated string instead of an array —
 * without this, `.map` on a string would iterate characters and drop all alcohol matches.
 */
export function normalizeOffTagList(raw: unknown): string[] {
  if (raw == null) {
    return []
  }

  if (Array.isArray(raw)) {
    const tags: string[] = []
    for (const item of raw) {
      tags.push(...normalizeOffTagList(item))
    }
    return tags
  }

  if (typeof raw !== 'string') {
    return []
  }

  const trimmed = raw.trim()
  if (!trimmed) {
    return []
  }

  if (trimmed.startsWith('[')) {
    try {
      const parsed = JSON.parse(trimmed) as unknown
      if (Array.isArray(parsed)) {
        return normalizeOffTagList(parsed)
      }
    } catch {
      // Fall through to delimiter split.
    }
  }

  return trimmed
    .split(/[,;|]/)
    .map((tag) => tag.trim().toLowerCase().replace(/^["']|["']$/g, ''))
    .filter(Boolean)
}

/**
 * True when OFF category tags (or ABV signal) indicate an alcoholic beverage
 * matching the selected import profile.
 */
export function isAlcoholicOffProduct(
  product: OffDumpProductLike,
  profile: OffDumpFilterProfile = 'curated'
): boolean {
  const tags = normalizeOffTagList(product.categories_tags)
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
      ...tags,
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
