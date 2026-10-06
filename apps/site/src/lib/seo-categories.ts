/**
 * Category slugs for future programmatic SEO hubs (`/categorie/{slug}`).
 * Keep aligned with `@atasoif/shared` ALCOHOL_CATEGORIES — duplicated here so the
 * site Docker image does not need the shared workspace package at build time.
 */
export const SEO_CATEGORY_SLUGS = [
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

export type SeoCategorySlug = (typeof SEO_CATEGORY_SLUGS)[number];

/** Short FR labels for stub / hub titles (informal tu pages later). */
export const SEO_CATEGORY_LABELS: Record<SeoCategorySlug, string> = {
  whisky: 'Whisky',
  rhum: 'Rhum',
  beer: 'Bière',
  wine: 'Vin',
  gin: 'Gin',
  cognac: 'Cognac',
  vodka: 'Vodka',
  liqueur: 'Liqueur',
  other: 'Autres alcools',
};
