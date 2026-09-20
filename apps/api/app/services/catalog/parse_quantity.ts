/**
 * Best-effort parse of retail quantity strings into millilitres.
 * Examples: "70 cl", "750 ml", "1 l", "33cl", "75 cL".
 */
export function parseVolumeMl(raw: string | null | undefined): number | null {
  if (!raw) {
    return null
  }

  const normalized = raw.trim().toLowerCase().replace(',', '.')
  const match = normalized.match(/(\d+(?:\.\d+)?)\s*(ml|cl|dl|l|litre|litres|liter|liters)\b/)
  if (!match) {
    return null
  }

  const value = Number(match[1])
  if (!Number.isFinite(value) || value <= 0) {
    return null
  }

  const unit = match[2]
  let ml: number
  if (unit === 'ml') {
    ml = value
  } else if (unit === 'cl') {
    ml = value * 10
  } else if (unit === 'dl') {
    ml = value * 100
  } else {
    ml = value * 1000
  }

  return Math.round(ml)
}

/**
 * Parse ABV from OFF nutriments or free-text percent strings.
 */
export function parseAbv(raw: unknown): number | null {
  if (typeof raw === 'number' && Number.isFinite(raw) && raw >= 0 && raw <= 100) {
    return Math.round(raw * 100) / 100
  }

  if (typeof raw === 'string') {
    const match = raw.replace(',', '.').match(/(\d+(?:\.\d+)?)\s*%?/)
    if (!match) {
      return null
    }
    const value = Number(match[1])
    if (!Number.isFinite(value) || value < 0 || value > 100) {
      return null
    }
    return Math.round(value * 100) / 100
  }

  return null
}
