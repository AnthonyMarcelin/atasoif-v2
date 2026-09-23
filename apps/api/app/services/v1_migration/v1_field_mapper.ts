/**
 * Pure field mapping helpers for Railway v1 → Adonis v2 (E2-T11).
 * No I/O — safe for unit tests with anonymized fixtures.
 */

export const V1_SKIP_USER_IDS = new Set([16])

/** Duplicate `lplin@orange.fr`: keep id 15, skip 16. */
export const V1_CANONICAL_OWNER_EMAIL = 'tongo33@gmail.com'

export const LEGACY_SUBSCRIPTION_PROVIDER = 'legacy_v1'
export const LEGACY_SUBSCRIPTION_PLAN = 'yearly'
export const LEGACY_SUBSCRIPTION_STATUS = 'ACTIVE' as const

export const V1_BOTTLE_SOURCE = 'legacy_v1'

export type V1CategorySlug = 'whisky' | 'beer' | 'rhum'

export type V1UserRow = {
  id: number
  email: string
  pseudo: string
  firstname: string
  lastname: string
  is_verified: boolean
  password: string
  created_at?: string | Date | null
  updated_at?: string | Date | null
}

export type V1BottleRow = {
  id: number
  name: string
  description: string | null
  review: string | null
  note: number | string | null
  price: number | string | null
  photo: string | null
  origin_country: string | null
  supplier_name: string | null
  supplier_address: string | null
  type_name: string | null
  label_name: string | null
  label_color: string | null
  peat_level_name?: string | null
  user_id: number
  created_at?: string | Date | null
  updated_at?: string | Date | null
}

export function shouldSkipV1User(user: Pick<V1UserRow, 'id' | 'email'>): boolean {
  if (V1_SKIP_USER_IDS.has(user.id)) {
    return true
  }
  return false
}

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase()
}

export function mapFullName(firstname: string, lastname: string): string {
  return `${firstname} ${lastname}`.replace(/\s+/g, ' ').trim()
}

export function formatBoughtAt(
  supplierName: string | null | undefined,
  supplierAddress: string | null | undefined
): string | null {
  const name = supplierName?.trim() || ''
  const address = supplierAddress?.trim() || ''
  if (!name && !address) {
    return null
  }
  if (name && address) {
    return `${name} — ${address}`
  }
  return name || address
}

export function mergeReviewAndDescription(
  review: string | null | undefined,
  description: string | null | undefined
): { review: string | null; descriptionAttr: string | null } {
  const r = review?.trim() || ''
  const d = description?.trim() || ''
  if (r && d && r !== d) {
    return { review: r, descriptionAttr: d }
  }
  if (r) {
    return { review: r, descriptionAttr: null }
  }
  if (d) {
    return { review: d, descriptionAttr: null }
  }
  return { review: null, descriptionAttr: null }
}

export function buildCatalogAttrs(bottle: V1BottleRow, categorySlug: V1CategorySlug): Record<string, unknown> {
  const attrs: Record<string, unknown> = {
    v1: { table: categorySlug, id: bottle.id },
  }
  if (bottle.type_name) {
    attrs.type = bottle.type_name
  }
  if (categorySlug === 'whisky' && bottle.peat_level_name) {
    attrs.peatLevel = bottle.peat_level_name
  }
  if (bottle.label_name) {
    attrs.qualityLabel = bottle.label_name
  }
  if (bottle.label_color) {
    attrs.qualityColor = bottle.label_color
  }
  const { descriptionAttr } = mergeReviewAndDescription(bottle.review, bottle.description)
  if (descriptionAttr) {
    attrs.description = descriptionAttr
  }
  return attrs
}

export function buildUserBottleAttrsOverride(
  bottle: V1BottleRow,
  categorySlug: V1CategorySlug
): Record<string, unknown> {
  return {
    v1: { table: categorySlug, id: bottle.id },
  }
}

export function parseNote(note: number | string | null | undefined): number | null {
  if (note === null || note === undefined || note === '') {
    return null
  }
  const n = typeof note === 'number' ? note : Number(note)
  return Number.isFinite(n) ? n : null
}

export function parsePrice(price: number | string | null | undefined): number | null {
  if (price === null || price === undefined || price === '') {
    return null
  }
  const n = typeof price === 'number' ? price : Number(price)
  return Number.isFinite(n) ? n : null
}

export function legacyBottleExternalId(categorySlug: V1CategorySlug, v1Id: number): string {
  return `${categorySlug}:${v1Id}`
}

export function mapUserFields(user: V1UserRow) {
  return {
    email: normalizeEmail(user.email),
    pseudo: user.pseudo.trim() || null,
    fullName: mapFullName(user.firstname, user.lastname) || null,
    emailVerified: Boolean(user.is_verified),
    password: user.password,
  }
}

export function mapBottleMemoryFields(bottle: V1BottleRow, categorySlug: V1CategorySlug) {
  const { review } = mergeReviewAndDescription(bottle.review, bottle.description)
  return {
    review,
    note: parseNote(bottle.note),
    pricePaid: parsePrice(bottle.price),
    boughtAt: formatBoughtAt(bottle.supplier_name, bottle.supplier_address),
    photoUrlOverride: bottle.photo?.trim() || null,
    fillLevel: 100,
    fillLevelUpdatesCount: 0,
    attrsOverride: buildUserBottleAttrsOverride(bottle, categorySlug),
  }
}
