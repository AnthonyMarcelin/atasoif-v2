/** Memory sheet completeness — shared by API (rewards) and web (display). */

export const MEMORY_SHEET_FIELD_COUNT = 4 as const;

/** Written review must be at least this long to count (anti « ok »). */
export const MEMORY_REVIEW_MIN_CHARS = 20;

export type MemorySheetFieldKey = 'pricePaid' | 'boughtAt' | 'note' | 'review';

export const MEMORY_SHEET_FIELDS: readonly MemorySheetFieldKey[] = [
  'pricePaid',
  'boughtAt',
  'note',
  'review',
] as const;

/** French labels for soft UI hints (informal « tu »). */
export const MEMORY_SHEET_FIELD_LABELS_FR: Record<MemorySheetFieldKey, string> = {
  pricePaid: 'prix',
  boughtAt: 'acheté chez',
  note: 'note',
  review: 'avis',
};

export type MemorySheetInput = {
  pricePaid?: number | string | null;
  boughtAt?: string | null;
  note?: number | string | null;
  review?: string | null;
};

export type MemorySheetCompleteness = {
  filled: number;
  total: typeof MEMORY_SHEET_FIELD_COUNT;
  complete: boolean;
  /** Ordered: pricePaid, boughtAt, note, review. */
  segments: boolean[];
  missing: MemorySheetFieldKey[];
};

function hasText(value: string | null | undefined): boolean {
  return typeof value === 'string' && value.trim().length > 0;
}

function hasFiniteNumber(value: number | string | null | undefined): boolean {
  if (value === null || value === undefined || value === '') {
    return false;
  }
  if (typeof value === 'number') {
    return Number.isFinite(value);
  }
  const normalized = String(value).trim().replace(',', '.');
  if (!normalized) {
    return false;
  }
  return Number.isFinite(Number(normalized));
}

export function isMemoryPriceFilled(input: MemorySheetInput): boolean {
  return hasFiniteNumber(input.pricePaid);
}

export function isMemoryPlaceFilled(input: MemorySheetInput): boolean {
  return hasText(input.boughtAt);
}

export function isMemoryNoteFilled(input: MemorySheetInput): boolean {
  return hasFiniteNumber(input.note);
}

export function isMemoryReviewFilled(input: MemorySheetInput): boolean {
  if (!hasText(input.review)) {
    return false;
  }
  return (input.review as string).trim().length >= MEMORY_REVIEW_MIN_CHARS;
}

export function isMemoryFieldFilled(
  input: MemorySheetInput,
  key: MemorySheetFieldKey,
): boolean {
  switch (key) {
    case 'pricePaid':
      return isMemoryPriceFilled(input);
    case 'boughtAt':
      return isMemoryPlaceFilled(input);
    case 'note':
      return isMemoryNoteFilled(input);
    case 'review':
      return isMemoryReviewFilled(input);
  }
}

/**
 * Pure completeness of a memory sheet (price, place, note, review ≥ 20 chars).
 * No persistence — callers derive display / reward eligibility from this.
 */
export function memorySheetCompleteness(input: MemorySheetInput): MemorySheetCompleteness {
  const segments = MEMORY_SHEET_FIELDS.map((key) => isMemoryFieldFilled(input, key));
  const missing = MEMORY_SHEET_FIELDS.filter((_, i) => !segments[i]);
  const filled = segments.filter(Boolean).length;
  return {
    filled,
    total: MEMORY_SHEET_FIELD_COUNT,
    complete: filled === MEMORY_SHEET_FIELD_COUNT,
    segments,
    missing,
  };
}

/** Soft FR hint for missing memory fields (add form — never blocks). */
export function memorySheetMissingHintFr(input: MemorySheetInput): string | null {
  const { missing, complete } = memorySheetCompleteness(input);
  if (complete || missing.length === 0) {
    return null;
  }
  const labels = missing.map((key) => MEMORY_SHEET_FIELD_LABELS_FR[key]);
  if (labels.length === 1) {
    return `Plus que ${labels[0]} pour une fiche complète.`;
  }
  if (labels.length === 2) {
    return `Encore ${labels[0]} et ${labels[1]} pour une fiche complète.`;
  }
  const head = labels.slice(0, -1).join(', ');
  const last = labels[labels.length - 1];
  return `Pour une fiche complète : ${head} et ${last}.`;
}
