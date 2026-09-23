/**
 * Wine fields on `bottles.attrs` and `user_bottles.attrs_override` (E2-T12).
 * Only the keys named by the ticket. Other categories do not use them.
 */

export const WINE_CATEGORY_SLUG = 'wine' as const;

export const WINE_ATTR_KEYS = ['appellation', 'grape', 'vintage'] as const;

export type WineAttrKey = (typeof WINE_ATTR_KEYS)[number];

/** Max trimmed length per key. Vintage stays a short millésime string. */
export const WINE_ATTR_LIMITS: Record<WineAttrKey, number> = {
  appellation: 255,
  grape: 255,
  vintage: 64,
};

export type WineAttrsInput = {
  appellation?: string | null;
  grape?: string | null;
  vintage?: string | null;
};

export function isWineCategorySlug(slug: string | null | undefined): boolean {
  return slug === WINE_CATEGORY_SLUG;
}

export function readWineAttr(
  source: Record<string, unknown> | null | undefined,
  key: WineAttrKey,
): string {
  const value = source?.[key];
  return typeof value === 'string' ? value.trim() : '';
}

/** Non-empty personal override wins. Otherwise the catalog `attrs` value. */
export function resolvedWineAttr(
  attrsOverride: Record<string, unknown> | null | undefined,
  catalogAttrs: Record<string, unknown> | null | undefined,
  key: WineAttrKey,
): string {
  const override = readWineAttr(attrsOverride, key);
  return override || readWineAttr(catalogAttrs, key);
}

/**
 * Merge a wine patch into `attrsOverride`.
 * Null or blank clears that key. Other JSON keys are kept.
 * A null patch clears every wine key.
 */
export function mergeWineAttrsOverride(
  current: Record<string, unknown> | null | undefined,
  patch: WineAttrsInput | null,
): Record<string, unknown> | null {
  const next: Record<string, unknown> = { ...(current ?? {}) };

  if (patch === null) {
    for (const key of WINE_ATTR_KEYS) {
      delete next[key];
    }
  } else {
    for (const key of WINE_ATTR_KEYS) {
      if (!Object.prototype.hasOwnProperty.call(patch, key)) {
        continue;
      }
      const raw = patch[key];
      if (raw === null || raw === undefined) {
        delete next[key];
        continue;
      }
      const value = raw.trim();
      if (!value) {
        delete next[key];
      } else {
        next[key] = value;
      }
    }
  }

  return Object.keys(next).length > 0 ? next : null;
}
