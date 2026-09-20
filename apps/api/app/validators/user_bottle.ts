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
 * Jauge fill level. Range only — premium entitlement is enforced in E2-T03.
 */
const fillLevel = () =>
  vine.number().withoutDecimals().min(FILL_LEVEL_MIN).max(FILL_LEVEL_MAX)

/**
 * Numeric score (`note`). Scale (/5, /10, /20) is not locked yet — keep flexible.
 */
const noteScore = () => vine.number().decimal([0, 1]).optional()

/**
 * Create payload shape for E2-T03 (validators ready; routes not in T01).
 * Free fields: boughtAt (place), pricePaid, note, review.
 * Premium write path later: fillLevel, photoUrlOverride.
 */
export const createUserBottleValidator = vine.create({
  bottleId: vine.number().withoutDecimals().positive().optional(),
  boughtAt: boughtAtPlace(),
  pricePaid: vine.number().min(0).decimal([0, 2]).optional(),
  note: noteScore(),
  review: vine.string().trim().maxLength(5000).optional(),
  fillLevel: fillLevel().optional(),
  photoUrlOverride: vine.string().trim().maxLength(2048).optional(),
})

/**
 * Update payload shape for E2-T03. `boughtAt` required when present on write path.
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
