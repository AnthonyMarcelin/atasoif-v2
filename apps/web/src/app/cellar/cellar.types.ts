/** Catalog + collection shapes returned by Adonis cellar APIs (E2). */

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
  meta: { freemium: FreemiumMeta };
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
}

export interface UpdateUserBottlePayload {
  boughtAt?: string;
  pricePaid?: number | null;
  note?: number | null;
  review?: string | null;
  nameOverride?: string | null;
  brandOverride?: string | null;
  originOverride?: string | null;
  /** Premium only. Free clients must omit this field (API returns 403). */
  fillLevel?: number;
}

/** Resolved display fields for list / detail (overrides win). */
export function displayName(entry: UserBottle): string {
  return entry.nameOverride?.trim() || entry.bottle?.name || 'Bouteille';
}

export function displayBrand(entry: UserBottle): string | null {
  const brand = entry.brandOverride?.trim() || entry.bottle?.brand?.trim();
  return brand || null;
}

export function displayPhotoUrl(entry: UserBottle): string | null {
  return entry.photoUrlOverride || entry.bottle?.photoUrl || null;
}

export function displayCategory(entry: UserBottle): CatalogCategory | null {
  return entry.bottle?.category ?? null;
}
