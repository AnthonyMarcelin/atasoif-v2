/** Product / billing constants shared by API + web */

export const FREE_BOTTLE_LIMIT = 10;

/** Max bonus slots from `user_rewards` on top of FREE_BOTTLE_LIMIT (conversion §2). */
export const FREE_BONUS_CAP = 5;

/**
 * Store IAP prices + intro trial lengths (App Store / Play only — no Stripe).
 * Prefs: 7 days yearly / 3 days monthly.
 */
export const PLANS = {
  monthly: { id: 'monthly', priceEur: 3.99, interval: 'month', trialDays: 3 },
  yearly: { id: 'yearly', priceEur: 39.99, interval: 'year', trialDays: 7 },
} as const;

export const ALCOHOL_CATEGORIES = [
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

export type AlcoholCategory = (typeof ALCOHOL_CATEGORIES)[number];

/**
 * Provenance keys for `bottle_sources.source`.
 * OFF = primary seed / live miss; UPCitemdb = EAN nurse fallback; user = manual miss.
 */
export const BOTTLE_SOURCES = {
  openfoodfacts: 'openfoodfacts',
  upcitemdb: 'upcitemdb',
  user: 'user',
} as const;

export type BottleSourceName = (typeof BOTTLE_SOURCES)[keyof typeof BOTTLE_SOURCES];

/**
 * Fill-level jauge (`user_bottles.fill_level`), percent 0–100.
 * Schema default for all plans; mutating is premium (E2-T03).
 * Ops « terminées » = FILL_LEVEL_FINISHED.
 */
export const FILL_LEVEL_MIN = 0;
export const FILL_LEVEL_MAX = 100;
export const FILL_LEVEL_DEFAULT = 100;
export const FILL_LEVEL_FINISHED = 0;

export {
  WINE_ATTR_KEYS,
  WINE_ATTR_LIMITS,
  WINE_CATEGORY_SLUG,
  isWineCategorySlug,
  mergeWineAttrsOverride,
  readWineAttr,
  resolvedWineAttr,
} from './wine-attrs';
export type { WineAttrKey, WineAttrsInput } from './wine-attrs';

export {
  BOTTLE_TYPES_BY_CATEGORY,
  BOTTLE_TYPE_ATTR_KEY,
  bottleTypesForCategory,
  readBottleType,
} from './bottle-types';

export {
  MEMORY_REVIEW_MIN_CHARS,
  MEMORY_SHEET_FIELD_COUNT,
  MEMORY_SHEET_FIELD_LABELS_FR,
  MEMORY_SHEET_FIELDS,
  isMemoryFieldFilled,
  isMemoryNoteFilled,
  isMemoryPlaceFilled,
  isMemoryPriceFilled,
  isMemoryReviewFilled,
  memorySheetCompleteness,
  memorySheetMissingHintFr,
} from './memory-sheet';
export type {
  MemorySheetCompleteness,
  MemorySheetFieldKey,
  MemorySheetInput,
} from './memory-sheet';
