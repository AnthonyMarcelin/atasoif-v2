/** Catalog + collection shapes returned by Adonis cellar APIs (E2). */

import { decodeHtmlEntities } from '../core/html-entities';

export interface CatalogCategory {
  id: number;
  slug: string;
  name: string;
}

export interface CatalogBottle {
  id: number;
  name: string;
  brand: string | null;
  origin: string | null;
  abv: number | null;
  volumeMl: number | null;
  barcode: string | null;
  photoUrl: string | null;
  /** `pending` when a user contributed the catalog packshot. Moderation UI is later. */
  photoStatus?: string | null;
  attrs: Record<string, unknown>;
  categoryId: number;
  category: CatalogCategory | null;
  /** Present on barcode lookup responses. */
  lookupOrigin?: string;
}

export interface FreemiumMeta {
  /** Lifetime creates consumed. Deleting a bottle does not free a slot. */
  count: number;
  limit: number;
  remaining: number | null;
  entitlement: boolean;
}

export interface UserBottle {
  id: number;
  userId: number;
  bottleId: number;
  nameOverride: string | null;
  brandOverride: string | null;
  originOverride: string | null;
  abvOverride: number | null;
  volumeMlOverride: number | null;
  photoUrlOverride: string | null;
  attrsOverride: Record<string, unknown> | null;
  note: number | null;
  review: string | null;
  pricePaid: number | null;
  boughtAt: string | null;
  fillLevel: number;
  fillLevelUpdatesCount: number;
  isPublic: boolean;
  createdAt: string;
  updatedAt: string | null;
  bottle: CatalogBottle | null;
}

export interface CollectionListResponse {
  data: UserBottle[];
  meta: {
    freemium: FreemiumMeta;
    total?: number;
    perPage?: number;
    currentPage?: number;
    lastPage?: number;
  };
}

export interface CollectionItemResponse {
  data: UserBottle;
  meta: { freemium: FreemiumMeta; photoProcessing?: boolean };
}

export interface CreateUserBottlePayload {
  bottleId?: number;
  bottle?: {
    name: string;
    brand?: string;
    origin?: string;
    abv?: number;
    volumeMl?: number;
    barcode?: string;
    photoUrl?: string;
    categoryId: number;
    attrs?: Record<string, unknown>;
  };
  boughtAt: string;
  pricePaid?: number;
  note?: number;
  review?: string;
  nameOverride?: string;
  brandOverride?: string;
  originOverride?: string;
  attrsOverride?: {
    appellation?: string | null;
    grape?: string | null;
    vintage?: string | null;
  };
}

export interface UpdateUserBottlePayload {
  boughtAt?: string;
  pricePaid?: number | null;
  note?: number | null;
  review?: string | null;
  nameOverride?: string | null;
  brandOverride?: string | null;
  originOverride?: string | null;
  attrsOverride?: {
    appellation?: string | null;
    grape?: string | null;
    vintage?: string | null;
  } | null;
  /** Premium only. Free clients must omit this field (API returns 403). */
  fillLevel?: number;
}

/** Resolved display fields for list / detail (overrides win). */
export function displayName(entry: UserBottle): string {
  const raw = entry.nameOverride?.trim() || entry.bottle?.name || 'Bouteille';
  return decodeHtmlEntities(raw);
}

export function displayBrand(entry: UserBottle): string | null {
  const brand = entry.brandOverride?.trim() || entry.bottle?.brand?.trim();
  return brand ? decodeHtmlEntities(brand) : null;
}

export function displayPhotoUrl(entry: UserBottle): string | null {
  return entry.photoUrlOverride || entry.bottle?.photoUrl || null;
}

export function displayCategory(entry: UserBottle): CatalogCategory | null {
  return entry.bottle?.category ?? null;
}

export function displayOrigin(entry: UserBottle): string | null {
  const origin = entry.originOverride?.trim() || entry.bottle?.origin?.trim();
  return origin ? decodeHtmlEntities(origin) : null;
}

export function displayAbv(entry: UserBottle): number | null {
  if (entry.abvOverride !== null && entry.abvOverride !== undefined) {
    return entry.abvOverride;
  }
  return entry.bottle?.abv ?? null;
}

export function displayVolumeMl(entry: UserBottle): number | null {
  if (entry.volumeMlOverride !== null && entry.volumeMlOverride !== undefined) {
    return entry.volumeMlOverride;
  }
  return entry.bottle?.volumeMl ?? null;
}

/** Format ABV for FR UI: `43,0%`. */
export function formatAbv(abv: number | null | undefined): string | null {
  if (abv === null || abv === undefined || !Number.isFinite(abv)) {
    return null;
  }
  const fixed = abv % 1 === 0 ? abv.toFixed(0) : abv.toFixed(1);
  return `${fixed.replace('.', ',')}%`;
}

/** Format volume ml as `70CL` / `33CL`. */
export function formatVolumeCl(volumeMl: number | null | undefined): string | null {
  if (volumeMl === null || volumeMl === undefined || !Number.isFinite(volumeMl) || volumeMl <= 0) {
    return null;
  }
  const cl = volumeMl / 10;
  const label = cl % 1 === 0 ? String(cl) : cl.toFixed(1).replace('.', ',');
  return `${label}CL`;
}

/** Format price: `62€` / `4,20€`. */
export function formatPriceEur(price: number | null | undefined): string | null {
  if (price === null || price === undefined || !Number.isFinite(price)) {
    return null;
  }
  if (price % 1 === 0) {
    return `${price}€`;
  }
  const compact = price.toFixed(2).replace(/0+$/, '').replace(/\.$/, '').replace('.', ',');
  return `${compact}€`;
}

/** Meta line: `ISLAY · 43,0% · 70CL` (skip missing parts). */
export function formatBottleMeta(parts: Array<string | null | undefined>): string {
  return parts
    .map((part) => (part ? String(part).trim() : ''))
    .filter(Boolean)
    .join(' · ');
}

export function catalogBottleTitle(bottle: CatalogBottle): string {
  return decodeHtmlEntities(bottle.name?.trim() || 'Bouteille');
}

export function catalogBottleBrand(bottle: CatalogBottle): string | null {
  const brand = bottle.brand?.trim();
  return brand ? decodeHtmlEntities(brand) : null;
}

export function catalogBottleMeta(bottle: CatalogBottle): string {
  return formatBottleMeta([
    bottle.category?.name?.toUpperCase() ?? null,
    formatAbv(bottle.abv),
    formatVolumeCl(bottle.volumeMl),
  ]);
}

/** Fill-level label for list cards. */
export function fillLevelLabel(fillLevel: number): string {
  if (fillLevel >= 100) {
    return 'SCELLÉE';
  }
  if (fillLevel <= 0) {
    return 'VIDE';
  }
  return `${Math.round(fillLevel)}%`;
}

/** Client-side note scale: /10 (API accepts up to 99,9). */
export const NOTE_MAX = 10;
