import vine from '@vinejs/vine'
import { FILL_LEVEL_MAX, FILL_LEVEL_MIN, WINE_ATTR_KEYS, WINE_ATTR_LIMITS } from '@atasoif/shared'

/**
 * « Acheté chez » / purchase place (maps to `user_bottles.bought_at`).
 * Free text — no closed enum (ops aggregates raw values).
 */
const boughtAtPlace = () => vine.string().trim().minLength(1).maxLength(255)

/**
 * Jauge fill level. Range only — premium entitlement is enforced in the service.
 */
const fillLevel = () => vine.number().withoutDecimals().min(FILL_LEVEL_MIN).max(FILL_LEVEL_MAX)

/**
 * Numeric score (`note`). Scale (/5, /10, /20) is not locked yet — keep flexible.
 */
const noteScore = () =>
  vine
    .number()
    .decimal([0, 1])
    .use(frenchRange(0, 99.9, 'La note doit rester entre 0 et 99,9'))
    .optional()

const pricePaid = () =>
  vine
    .number()
    .decimal([0, 2])
    .use(frenchRange(0, 99_999_999.99, 'Le prix est trop élevé.'))

const volumeMl = () =>
  vine
    .number()
    .withoutDecimals()
    .positive()
    .use(frenchRange(1, 200_000, 'Le volume est trop élevé.'))

/**
 * `note` is decimal(3,1) and `price_paid` is decimal(10,2). Values past that
 * precision used to surface as a database 500.
 */
function frenchRange(min: number, max: number, message: string) {
  return vine.createRule((value: unknown, _options, field) => {
    if (value === null || value === undefined) {
      return
    }
    if (typeof value !== 'number' || !Number.isFinite(value) || value < min || value > max) {
      field.report(message, 'decimal.bounds', field)
    }
  })()
}

const barcodeDigits = vine.createRule((value: unknown, _options, field) => {
  if (typeof value !== 'string' || !/^\d{8,14}$/.test(value)) {
    field.report('Le code-barres doit contenir 8 à 14 chiffres', 'barcode.format', field)
  }
})

/**
 * Wine keys only (`appellation`, `grape`, `vintage`). See docs/DATABASE.md.
 * Blank or null clears that key in `attrsOverride`. Unknown keys are rejected.
 */
const wineAttrText = (maxLength: number) =>
  vine.string().trim().maxLength(maxLength).nullable().optional()

const WINE_ATTR_KEY_SET = new Set<string>(WINE_ATTR_KEYS)

/**
 * Vine objects drop unknown keys instead of failing. Reject them so a client
 * cannot think an undocumented wine key was saved.
 */
const rejectUnknownWineKeys = vine.createRule((value: unknown, _options, field) => {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    return
  }
  for (const key of Object.keys(value)) {
    if (!WINE_ATTR_KEY_SET.has(key)) {
      field.report('Clé de vin inconnue', 'wine.unknownKey', field)
      return
    }
  }
})

const wineAttrsOverride = () =>
  vine
    .object({
      appellation: wineAttrText(WINE_ATTR_LIMITS.appellation),
      grape: wineAttrText(WINE_ATTR_LIMITS.grape),
      vintage: wineAttrText(WINE_ATTR_LIMITS.vintage),
    })
    .use(rejectUnknownWineKeys())
    .nullable()
    .optional()

const catalogMissBottle = {
  name: vine.string().trim().minLength(1).maxLength(255),
  brand: vine.string().trim().maxLength(255).optional(),
  origin: vine.string().trim().maxLength(255).optional(),
  abv: vine.number().min(0).max(100).decimal([0, 2]).optional(),
  volumeMl: volumeMl().optional(),
  barcode: vine.string().trim().use(barcodeDigits()).optional(),
  photoUrl: vine.string().trim().maxLength(2048).optional(),
  categoryId: vine.number().withoutDecimals().positive(),
  attrs: vine.record(vine.any()).optional(),
}

/**
 * Create payload — catalog hit (`bottleId`) or miss (`bottle` + user source).
 * Free fields: boughtAt (place), pricePaid, note, review, catalog overrides.
 * Premium write path: fillLevel, photoUrlOverride (gated in CollectionService).
 */
export const createUserBottleValidator = vine.create({
  bottleId: vine.number().withoutDecimals().positive().optional(),
  bottle: vine.object(catalogMissBottle).optional(),
  boughtAt: boughtAtPlace(),
  pricePaid: pricePaid().optional(),
  note: noteScore(),
  review: vine.string().trim().maxLength(5000).optional(),
  fillLevel: fillLevel().optional(),
  photoUrlOverride: vine.string().trim().maxLength(2048).optional(),
  nameOverride: vine.string().trim().maxLength(255).optional(),
  brandOverride: vine.string().trim().maxLength(255).optional(),
  originOverride: vine.string().trim().maxLength(255).optional(),
  abvOverride: vine.number().min(0).max(100).decimal([0, 2]).optional(),
  volumeMlOverride: volumeMl().optional(),
  attrsOverride: wineAttrsOverride(),
  isPublic: vine.boolean().optional(),
})

/**
 * Update payload. `boughtAt` required when present; never clear place to empty.
 * Premium write path: fillLevel, photoUrlOverride (gated in CollectionService).
 */
export const updateUserBottleValidator = vine.create({
  boughtAt: boughtAtPlace().optional(),
  pricePaid: pricePaid().nullable().optional(),
  note: vine
    .number()
    .decimal([0, 1])
    .use(frenchRange(0, 99.9, 'La note doit rester entre 0 et 99,9'))
    .nullable()
    .optional(),
  review: vine.string().trim().maxLength(5000).nullable().optional(),
  fillLevel: fillLevel().optional(),
  photoUrlOverride: vine.string().trim().maxLength(2048).nullable().optional(),
  nameOverride: vine.string().trim().maxLength(255).nullable().optional(),
  brandOverride: vine.string().trim().maxLength(255).nullable().optional(),
  originOverride: vine.string().trim().maxLength(255).nullable().optional(),
  abvOverride: vine.number().min(0).max(100).decimal([0, 2]).nullable().optional(),
  volumeMlOverride: volumeMl().nullable().optional(),
  attrsOverride: wineAttrsOverride(),
  isPublic: vine.boolean().optional(),
})

/**
 * List / filter personal collection. Stable sort is applied in the service.
 */
export const listUserBottlesValidator = vine.create({
  category: vine.string().trim().maxLength(64).optional(),
  categoryId: vine.number().withoutDecimals().positive().optional(),
  limit: vine.number().withoutDecimals().min(1).max(50).optional(),
  page: vine.number().withoutDecimals().min(1).max(100).optional(),
})
