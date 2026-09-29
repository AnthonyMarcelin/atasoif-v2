import {
  WINE_ATTR_KEYS,
  readWineAttr,
  type WineAttrsInput,
} from '@atasoif/shared';

export interface WineAttrFormValue {
  appellation: string;
  grape: string;
  vintage: string;
}

/** Personal override: keep a value only when it differs from the catalog attr. */
export function wineOverrideFromForm(
  entered: WineAttrFormValue,
  catalogAttrs: Record<string, unknown> | null | undefined,
): WineAttrsInput {
  const patch: WineAttrsInput = {};
  for (const key of WINE_ATTR_KEYS) {
    const value = entered[key].trim();
    const catalog = readWineAttr(catalogAttrs, key);
    patch[key] = value && value !== catalog ? value : null;
  }
  return patch;
}

export function wineOverrideHasValue(patch: WineAttrsInput): boolean {
  return WINE_ATTR_KEYS.some((key) => {
    const value = patch[key];
    return typeof value === 'string' && value.trim().length > 0;
  });
}

/** Catalog attrs for a manual wine miss. Empty keys are omitted. */
export function wineCatalogAttrs(
  entered: WineAttrFormValue,
): Record<string, string> | undefined {
  const attrs: Record<string, string> = {};
  for (const key of WINE_ATTR_KEYS) {
    const value = entered[key].trim();
    if (value) {
      attrs[key] = value;
    }
  }
  return Object.keys(attrs).length > 0 ? attrs : undefined;
}
