/** Alcohol category slugs mirrored from index (avoid circular import). */
const CATEGORY_SLUGS = [
  'whisky',
  'rhum',
  'beer',
  'wine',
  'gin',
  'cognac',
  'vodka',
  'liqueur',
  'other',
] as const;

type CategorySlug = (typeof CATEGORY_SLUGS)[number];

/**
 * Prefill type hints by alcohol category (taxo v1).
 * Used when the catalog row has no `attrs.type` yet.
 */
export const BOTTLE_TYPES_BY_CATEGORY: Record<CategorySlug, readonly string[]> = {
  whisky: ['Single malt', 'Blend', 'Bourbon', 'Rye', 'Grain', 'Japonais', 'Autre'],
  rhum: ['Agricole', 'Traditionnel', 'Arrangé', 'Épicé', 'Blanc', 'Ambré', 'Autre'],
  beer: ['IPA', 'Lager', 'Stout', 'Sour', 'Wheat', 'Autre'],
  wine: ['Rouge', 'Blanc', 'Rosé', 'Effervescent', 'Orange', 'Autre'],
  gin: ['London dry', 'Old tom', 'Navy strength', 'Flavoured', 'Autre'],
  cognac: ['VS', 'VSOP', 'XO', 'Hors d’âge', 'Autre'],
  vodka: ['Classique', 'Infusée', 'Autre'],
  liqueur: ['Fruitée', 'Herbacée', 'Crème', 'Autre'],
  other: ['Spiritueux', 'Apéritif', 'Autre'],
} as const;

export const BOTTLE_TYPE_ATTR_KEY = 'type' as const;

export function bottleTypesForCategory(
  slug: string | null | undefined,
): readonly string[] {
  if (!slug) {
    return BOTTLE_TYPES_BY_CATEGORY.other;
  }
  if ((CATEGORY_SLUGS as readonly string[]).includes(slug)) {
    return BOTTLE_TYPES_BY_CATEGORY[slug as CategorySlug];
  }
  return BOTTLE_TYPES_BY_CATEGORY.other;
}

export function readBottleType(
  source: Record<string, unknown> | null | undefined,
): string {
  const value = source?.[BOTTLE_TYPE_ATTR_KEY];
  return typeof value === 'string' ? value.trim() : '';
}
