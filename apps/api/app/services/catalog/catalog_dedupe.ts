import type { AlcoholCategory } from '@atasoif/shared'
import { normalizeIdentityKey } from '#services/catalog/clean_retail_name'
import type { CatalogProductDraft } from '#services/catalog/catalog_types'

/** Preferred bottle sizes (ml) by category — pick closest when scoring. */
const PREFERRED_VOLUME_ML: Partial<Record<AlcoholCategory, number>> = {
  whisky: 700,
  rhum: 700,
  gin: 700,
  vodka: 700,
  cognac: 700,
  liqueur: 700,
  beer: 330,
  wine: 750,
  other: 700,
}

export type DedupeCandidate = {
  key: string
  draft: CatalogProductDraft
  score: number
}

/**
 * Score a draft so we keep the best-presented SKU among brand+name variants
 * (70cl vs 1L vs multipacks). Higher is better.
 */
export function scoreCatalogDraft(draft: CatalogProductDraft): number {
  let score = 0

  if (draft.photoUrl) {
    score += 40
  }
  if (draft.abv !== null && draft.abv > 0) {
    score += 15
  }
  if (draft.brand) {
    score += 10
  }
  if (draft.origin) {
    score += 5
  }

  const preferred = PREFERRED_VOLUME_ML[draft.categorySlug] ?? 700
  if (draft.volumeMl !== null && draft.volumeMl > 0) {
    const distance = Math.abs(draft.volumeMl - preferred)
    score += Math.max(0, 25 - Math.floor(distance / 50))
    // Penalise obvious multipacks / party sizes.
    if (draft.volumeMl >= 1500) {
      score -= 20
    }
    if (draft.volumeMl <= 50) {
      score -= 10
    }
  }

  const lower = draft.name.toLowerCase()
  if (/\b(pack|lot|carton|x\s*\d+)\b/.test(lower)) {
    score -= 25
  }

  // Prefer reasonably short, clean names.
  if (draft.name.length > 0 && draft.name.length <= 60) {
    score += 5
  } else if (draft.name.length > 90) {
    score -= 5
  }

  return score
}

/**
 * In-memory brand+name dedupe for curated dump imports (thousands of refs).
 */
export class CatalogDedupeBuffer {
  private readonly winners = new Map<string, DedupeCandidate>()

  get size(): number {
    return this.winners.size
  }

  /**
   * Offer a draft. Returns true when it becomes (or remains) the winner for its key.
   */
  offer(draft: CatalogProductDraft): { kept: boolean; key: string; replaced: boolean } {
    const key = normalizeIdentityKey(draft.brand, draft.name)
    if (!key || key === '|') {
      return { kept: true, key, replaced: false }
    }

    const score = scoreCatalogDraft(draft)
    const existing = this.winners.get(key)
    if (!existing || score > existing.score) {
      const replaced = Boolean(existing)
      this.winners.set(key, { key, draft, score })
      return { kept: true, key, replaced }
    }

    return { kept: false, key, replaced: false }
  }

  values(): CatalogProductDraft[] {
    return [...this.winners.values()].map((entry) => entry.draft)
  }
}
