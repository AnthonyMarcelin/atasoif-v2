import type { UserBottle } from './cellar.types';

/**
 * Provisional cellar level titles (conversion-premium §4).
 * Cosmetic until a dedicated levels API lands — safe for share stamps.
 */
export type CellarLevelTitle = 'CURIEUX' | 'AMATEUR' | 'CONNAISSEUR' | 'MAÎTRE DE CHAI';

export function isMemoryComplete(entry: UserBottle): boolean {
  const review = entry.review?.trim() ?? '';
  return (
    entry.pricePaid !== null &&
    entry.pricePaid !== undefined &&
    Boolean(entry.boughtAt?.trim()) &&
    entry.note !== null &&
    entry.note !== undefined &&
    review.length >= 20
  );
}

export function cellarLevelTitle(bottles: UserBottle[]): CellarLevelTitle {
  const complete = bottles.filter(isMemoryComplete).length;
  const categories = new Set(
    bottles
      .map((b) => b.bottle?.category?.slug?.toLowerCase())
      .filter((slug): slug is string => Boolean(slug)),
  );
  const catCount = categories.size;

  if (complete >= 40 && catCount >= 5) {
    return 'MAÎTRE DE CHAI';
  }
  if (complete >= 15 && catCount >= 3) {
    return 'CONNAISSEUR';
  }
  if (complete >= 5 && catCount >= 2) {
    return 'AMATEUR';
  }
  return 'CURIEUX';
}

export interface CategoryMixItem {
  slug: string;
  label: string;
  count: number;
  color: string;
}

const CATEGORY_LABELS: Record<string, string> = {
  whisky: 'WHISKY',
  rhum: 'RHUM',
  rum: 'RHUM',
  wine: 'VIN',
  vin: 'VIN',
  gin: 'GIN',
  beer: 'BIÈRE',
  biere: 'BIÈRE',
  cognac: 'COGNAC',
  vodka: 'VODKA',
  liqueur: 'LIQUEUR',
  other: 'AUTRE',
  autre: 'AUTRE',
};

/** Top category counts for the cave mix row (max 5). */
export function categoryMix(
  bottles: UserBottle[],
  colorOf: (slug: string) => string,
  limit = 5,
): CategoryMixItem[] {
  const counts = new Map<string, { label: string; count: number }>();
  for (const entry of bottles) {
    const slug = entry.bottle?.category?.slug?.toLowerCase() || 'other';
    const label =
      CATEGORY_LABELS[slug] ||
      (entry.bottle?.category?.name ?? 'Autre').toUpperCase();
    const prev = counts.get(slug);
    if (prev) {
      prev.count += 1;
    } else {
      counts.set(slug, { label, count: 1 });
    }
  }
  return [...counts.entries()]
    .map(([slug, value]) => ({
      slug,
      label: value.label,
      count: value.count,
      color: colorOf(slug),
    }))
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label, 'fr'))
    .slice(0, limit);
}

/** Newest first for the six-tile grid. */
export function latestBottles(bottles: UserBottle[], limit = 6): UserBottle[] {
  return [...bottles]
    .sort((a, b) => {
      const ta = Date.parse(a.createdAt) || 0;
      const tb = Date.parse(b.createdAt) || 0;
      return tb - ta;
    })
    .slice(0, limit);
}
