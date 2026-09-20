import vine from '@vinejs/vine'
import {
  FILL_LEVEL_MAX,
  FILL_LEVEL_MIN,
} from '@atasoif/shared'

/**
 * « Acheté chez » / purchase place (maps to `user_bottles.bought_at`).
 * Free text — no closed enum (ops aggregates raw values).
 */
const boughtAtPlace = () => vine.string().trim().minLength(1).maxLength(255)

/**
 * Jauge fill level. Range only — premium entitlement is enforced in the service.
 */
const fillLevel = () =>
  vine.number().withoutDecimals().min(FILL_LEVEL_MIN).max(FILL_LEVEL_MAX)

/**
 * Numeric score (`note`). Scale (/5, /10, /20) is not locked yet — keep flexible.
 */
const noteScore = () => vine.number().decimal([0, 1]).optional()

const catalogMissBottle = {
  name: vine.string().trim().minLength(1).maxLength(255),
  brand: vine.string().trim().maxLength(255).optional(),
  origin: vine.string().trim().maxLength(255).optional(),
  abv: vine.number().min(0).max(100).decimal([0, 2]).optional(),
  volumeMl: vine.number().withoutDecimals().positive().optional(),
  barcode: vine.string().trim().maxLength(32).optional(),
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
  pricePaid: vine.number().min(0).decimal([0, 2]).optional(),
  note: noteScore(),
  review: vine.string().trim().maxLength(5000).optional(),
  fillLevel: fillLevel().optional(),
  photoUrlOverride: vine.string().trim().maxLength(2048).optional(),
  nameOverride: vine.string().trim().maxLength(255).optional(),
  brandOverride: vine.string().trim().maxLength(255).optional(),
  originOverride: vine.string().trim().maxLength(255).optional(),
  abvOverride: vine.number().min(0).max(100).decimal([0, 2]).optional(),
  volumeMlOverride: vine.number().withoutDecimals().positive().optional(),
  isPublic: vine.boolean().optional(),
})

/**
 * Update payload. `boughtAt` required when present; never clear place to empty.
 * Premium write path: fillLevel, photoUrlOverride (gated in CollectionService).
 */
export const updateUserBottleValidator = vine.create({
  boughtAt: boughtAtPlace().optional(),
  pricePaid: vine.number().min(0).decimal([0, 2]).nullable().optional(),
  note: vine.number().decimal([0, 1]).nullable().optional(),
  review: vine.string().trim().maxLength(5000).nullable().optional(),
  fillLevel: fillLevel().optional(),
  photoUrlOverride: vine.string().trim().maxLength(2048).nullable().optional(),
  nameOverride: vine.string().trim().maxLength(255).nullable().optional(),
  brandOverride: vine.string().trim().maxLength(255).nullable().optional(),
  originOverride: vine.string().trim().maxLength(255).nullable().optional(),
  abvOverride: vine.number().min(0).max(100).decimal([0, 2]).nullable().optional(),
  volumeMlOverride: vine.number().withoutDecimals().positive().nullable().optional(),
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
