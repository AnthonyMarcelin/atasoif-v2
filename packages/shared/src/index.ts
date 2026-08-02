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
