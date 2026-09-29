/**
 * Strip noisy retail / multipack noise from OFF product names.
 * Keeps the drink identity; volume lives on `volumeMl` / quantity.
 */

const NOISE_PATTERNS: RegExp[] = [
  // Multipacks first (greedy): "pack de 6 x 33cl", "6x33cl", …
  /\bpack\s*(?:de\s*)?\d+(?:\s*(?:x|\u00d7)\s*\d+(?:\s*(?:cl|ml|l))?)?\b/gi,
  /\blot\s*(?:de\s*)?\d+(?:\s*(?:x|\u00d7)\s*\d+(?:\s*(?:cl|ml|l))?)?\b/gi,
  /\bcarton\s*(?:de\s*)?\d+\b/gi,
  /\bbo[iî]te\s*(?:de\s*)?\d+\b/gi,
  /\b\d+\s*(?:x|\u00d7)\s*\d+(?:\s*(?:cl|ml|l))?\b/gi,
  /\b(?:x|\u00d7)\s*\d+(?:\s*(?:cl|ml|l))?\b/gi,
  /\b\d+(?:[.,]\d+)?\s*(?:cl|ml|l|litre|litres)\b/gi,
  /\b\d+[.,]\d{2}\s*€/gi,
  /\bpromo(?:tion)?\b/gi,
  /\boffre\s+sp[eé]ciale\b/gi,
  /\bvoir\s+description\b/gi,
  /\[[^\]]*]/g,
  /\([^)]*(?:pack|lot|promo|x\s*\d+)[^)]*\)/gi,
]

/**
 * Normalize a retail product name for display (not the dedupe key).
 */
export function cleanRetailName(raw: string, brand?: string | null): string {
  let name = raw.normalize('NFC').trim()
  if (!name) {
    return name
  }

  for (const pattern of NOISE_PATTERNS) {
    name = name.replace(pattern, ' ')
  }

  name = name
    .replace(/[_/|]+/g, ' ')
    .replace(/\s{2,}/g, ' ')
    .replace(/^[\s\-–—,.;:]+|[\s\-–—,.;:]+$/g, '')
    .trim()

  const brandTrim = brand?.trim()
  if (brandTrim) {
    const brandRe = new RegExp(`^${escapeRegExp(brandTrim)}\\s*[-–—:,]?\\s*`, 'i')
    const withoutBrandPrefix = name.replace(brandRe, '').trim()
    // Keep brand in the name when stripping would leave a tiny stub.
    if (withoutBrandPrefix.length >= 3) {
      name = withoutBrandPrefix
    }
  }

  return name || raw.trim()
}

/**
 * Identity key for brand+name dedupe (volume / pack variants collapse).
 */
export function normalizeIdentityKey(brand: string | null | undefined, name: string): string {
  const cleanedName = cleanRetailName(name, brand)
  const brandPart = (brand ?? '')
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()

  const namePart = cleanedName
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()

  return `${brandPart}|${namePart}`
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}
