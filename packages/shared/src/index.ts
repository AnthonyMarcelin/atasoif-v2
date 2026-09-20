/** Product / billing constants shared by API + web */

export const FREE_BOTTLE_LIMIT = 10;

export const PLANS = {
  monthly: { id: 'monthly', priceEur: 3.99, interval: 'month' },
  yearly: { id: 'yearly', priceEur: 39.99, interval: 'year' },
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
 * Fill-level jauge (`user_bottles.fill_level`), percent 0–100.
 * Schema default for all plans; mutating is premium (E2-T03).
 * Ops « terminées » = FILL_LEVEL_FINISHED.
 */
export const FILL_LEVEL_MIN = 0;
export const FILL_LEVEL_MAX = 100;
export const FILL_LEVEL_DEFAULT = 100;
export const FILL_LEVEL_FINISHED = 0;
