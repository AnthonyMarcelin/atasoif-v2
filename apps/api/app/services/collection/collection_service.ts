import { readFile } from 'node:fs/promises'
import { DateTime } from 'luxon'
import type { MultipartFile } from '@adonisjs/core/bodyparser'
import type { TransactionClientContract } from '@adonisjs/lucid/types/database'
import db from '@adonisjs/lucid/services/db'
import {
  BOTTLE_SOURCES,
  BOTTLE_TYPE_ATTR_KEY,
  FILL_LEVEL_DEFAULT,
  FREE_BOTTLE_LIMIT,
  isWineCategorySlug,
  mergeWineAttrsOverride,
  WINE_ATTR_KEYS,
  type WineAttrKey,
  type WineAttrsInput,
} from '@atasoif/shared'
import ProcessCellarPhoto from '#jobs/process_cellar_photo'
import Bottle from '#models/bottle'
import BottleSource from '#models/bottle_source'
import Category from '#models/category'
import User from '#models/user'
import UserBottle from '#models/user_bottle'
import CellarPhotoProcessor from '#services/cellar_photo_processor'
import CellarPhotoStorage, { overridePhotoPath } from '#services/cellar_photo_storage'
import { CollectionError } from '#services/collection/collection_error'
import EntitlementService from '#services/entitlement_service'
import { isHeicHeader } from '#services/image_signature'
import { isCatalogPhotoUrl, isHttpPhotoUrl, isOwnShelfPhotoUrl } from '#services/photo_url'
import { readPostgresUniqueViolation } from '#services/postgres_error'

export { CollectionError } from '#services/collection/collection_error'

export type FreemiumSnapshot = {
  /** Lifetime creates consumed. Deletes do not free a slot. */
  count: number
  limit: number
  remaining: number | null
  entitlement: boolean
}

export type PremiumFeature = 'fillLevel' | 'photoOverride'

const PENDING_PHOTO_STATUS = 'pending'

type BottleAttrsInput = WineAttrsInput & { type?: string | null }

type CreateBottleMiss = {
  name: string
  brand?: string
  origin?: string
  abv?: number
  volumeMl?: number
  barcode?: string
  photoUrl?: string
  categoryId: number
  attrs?: BottleAttrsInput
}

export type CreateUserBottleInput = {
  bottleId?: number
  bottle?: CreateBottleMiss
  boughtAt: string
  pricePaid?: number
  note?: number
  review?: string
  fillLevel?: number
  photoUrlOverride?: string
  nameOverride?: string
  brandOverride?: string
  originOverride?: string
  abvOverride?: number
  volumeMlOverride?: number
  attrsOverride?: BottleAttrsInput | null
  isPublic?: boolean
}

export type UpdateUserBottleInput = {
  boughtAt?: string
  pricePaid?: number | null
  note?: number | null
  review?: string | null
  fillLevel?: number
  photoUrlOverride?: string | null
  nameOverride?: string | null
  brandOverride?: string | null
  originOverride?: string | null
  abvOverride?: number | null
  volumeMlOverride?: number | null
  attrsOverride?: BottleAttrsInput | null
  isPublic?: boolean
}

export type ListUserBottlesInput = {
  category?: string
  categoryId?: number
  limit?: number
  page?: number
}

/**
 * Personal cellar CRUD with a lifetime freemium cap + premium gates (E2-T03).
 * `users.bottles_created_count` increments on successful create and never
 * decrements on delete. Does not mutate global Bottle rows for personal fields.
 */
export default class CollectionService {
  constructor(private readonly entitlements: EntitlementService = new EntitlementService()) {}

  /**
   * Freemium payload for API responses. `count` is lifetime creates.
   * `remaining` is null when entitled (uncapped).
   */
  async freemiumPayload(userId: number): Promise<FreemiumSnapshot> {
    const entitlement = await this.entitlements.hasActiveEntitlement(userId)
    const count = await this.countFor(userId)
    return {
      count,
      limit: FREE_BOTTLE_LIMIT,
      remaining: entitlement ? null : Math.max(0, FREE_BOTTLE_LIMIT - count),
      entitlement,
    }
  }

  /**
   * Slots consumed for the life of the account, not the current row count.
   */
  async countFor(userId: number): Promise<number> {
    const user = await User.findOrFail(userId)
    return Number(user.bottlesCreatedCount ?? 0)
  }

  async list(userId: number, input: ListUserBottlesInput) {
    const limit = input.limit ?? 20
    const page = input.page ?? 1

    const query = UserBottle.query()
      .where('user_id', userId)
      .preload('bottle', (bottleQuery) => {
        bottleQuery.preload('category')
      })
      .orderBy('created_at', 'desc')
      .orderBy('id', 'desc')

    if (input.categoryId) {
      query.whereHas('bottle', (bottleQuery) => {
        bottleQuery.where('category_id', input.categoryId!)
      })
    } else if (input.category) {
      query.whereHas('bottle', (bottleQuery) => {
        bottleQuery.whereHas('category', (categoryQuery) => {
          categoryQuery.where('slug', input.category!)
        })
      })
    }

    return query.paginate(page, limit)
  }

  async findOwned(userId: number, id: number): Promise<UserBottle> {
    const row = await UserBottle.query()
      .where('id', id)
      .where('user_id', userId)
      .preload('bottle', (bottleQuery) => {
        bottleQuery.preload('category')
      })
      .first()

    if (!row) {
      throw new CollectionError(
        'E_USER_BOTTLE_NOT_FOUND',
        'Cette bouteille n’est pas dans ta cave',
        404
      )
    }

    return row
  }

  async create(userId: number, input: CreateUserBottleInput): Promise<UserBottle> {
    const hasBottleId = input.bottleId !== undefined && input.bottleId !== null
    const hasMiss = input.bottle !== undefined && input.bottle !== null

    if (hasBottleId === hasMiss) {
      throw new CollectionError(
        'E_INVALID_CREATE',
        'Indique un bottleId catalogue ou un objet bottle (miss)',
        422
      )
    }

    const entitlement = await this.entitlements.hasActiveEntitlement(userId)
    this.assertPremiumWrites(entitlement, {
      fillLevel: input.fillLevel,
      photoUrlOverride: input.photoUrlOverride,
    })
    this.assertStoredPhotoUrls(input)

    try {
      return await db.transaction(async (trx) => {
        const locked = await trx
          .from('users')
          .where('id', userId)
          .forUpdate()
          .select('bottles_created_count')
          .first()
        const createdCount = Number(locked?.bottles_created_count ?? 0)
        this.assertBottleCap(createdCount, entitlement)

        let bottleId = input.bottleId
        let categorySlug: string | null = null

        if (hasMiss && input.bottle) {
          const category = await Category.find(input.bottle.categoryId, { client: trx })
          if (!category) {
            throw new CollectionError('E_CATEGORY_NOT_FOUND', 'Catégorie introuvable', 422)
          }
          categorySlug = category.slug

          const bottle = await Bottle.create(
            {
              name: input.bottle.name,
              brand: input.bottle.brand ?? null,
              origin: input.bottle.origin ?? null,
              abv: input.bottle.abv ?? null,
              volumeMl: input.bottle.volumeMl ?? null,
              barcode: input.bottle.barcode ?? null,
              photoUrl: input.bottle.photoUrl ?? null,
              photoStatus: input.bottle.photoUrl ? PENDING_PHOTO_STATUS : null,
              categoryId: category.id,
              attrs: this.resolveCatalogMissAttrs(category.slug, input.bottle.attrs),
            },
            { client: trx }
          )

          await BottleSource.create(
            {
              bottleId: bottle.id,
              source: BOTTLE_SOURCES.user,
              externalId: `user:${userId}:${bottle.id}`,
              rawHash: null,
              lastSyncedAt: DateTime.utc(),
            },
            { client: trx }
          )

          bottleId = bottle.id
        } else {
          const catalogBottle = await Bottle.query({ client: trx })
            .where('id', bottleId!)
            .whereNull('deleted_at')
            .first()
          if (!catalogBottle) {
            throw new CollectionError('E_BOTTLE_NOT_FOUND', 'Bouteille catalogue introuvable', 404)
          }
          await catalogBottle.load('category')
          categorySlug = catalogBottle.category?.slug ?? null
        }

        const attrsOverride =
          input.attrsOverride !== undefined
            ? this.resolveWineAttrs(categorySlug, null, input.attrsOverride)
            : null

        const existing = await UserBottle.query({ client: trx })
          .where('user_id', userId)
          .where('bottle_id', bottleId!)
          .first()
        if (existing) {
          throw new CollectionError(
            'E_USER_BOTTLE_EXISTS',
            'Cette bouteille est déjà dans ta cave',
            409
          )
        }

        const row = await UserBottle.create(
          {
            userId,
            bottleId: bottleId!,
            boughtAt: input.boughtAt,
            pricePaid: input.pricePaid ?? null,
            note: input.note ?? null,
            review: input.review ?? null,
            fillLevel:
              entitlement && input.fillLevel !== undefined ? input.fillLevel : FILL_LEVEL_DEFAULT,
            fillLevelUpdatesCount:
              entitlement && input.fillLevel !== undefined && input.fillLevel !== FILL_LEVEL_DEFAULT
                ? 1
                : 0,
            photoUrlOverride: entitlement ? (input.photoUrlOverride ?? null) : null,
            nameOverride: input.nameOverride ?? null,
            brandOverride: input.brandOverride ?? null,
            originOverride: input.originOverride ?? null,
            abvOverride: input.abvOverride ?? null,
            volumeMlOverride: input.volumeMlOverride ?? null,
            attrsOverride,
            isPublic: input.isPublic ?? false,
          },
          { client: trx }
        )

        await trx
          .from('users')
          .where('id', userId)
          .update({
            bottles_created_count: createdCount + 1,
          })

        await row.load('bottle', (bottleQuery) => {
          bottleQuery.preload('category')
        })

        return row
      })
    } catch (error) {
      throw this.translateUnique(error)
    }
  }

  async update(userId: number, id: number, input: UpdateUserBottleInput): Promise<UserBottle> {
    const entitlement = await this.entitlements.hasActiveEntitlement(userId)

    this.assertPremiumWrites(entitlement, {
      fillLevel: input.fillLevel,
      photoUrlOverride: input.photoUrlOverride,
    })
    this.assertStoredPhotoUrls(input, id)

    return db.transaction(async (trx) => {
      const row = await this.lockOwned(userId, id, trx)

      if (input.boughtAt !== undefined) {
        row.boughtAt = input.boughtAt
      }
      if (input.pricePaid !== undefined) {
        row.pricePaid = input.pricePaid
      }
      if (input.note !== undefined) {
        row.note = input.note
      }
      if (input.review !== undefined) {
        row.review = input.review
      }
      if (input.nameOverride !== undefined) {
        row.nameOverride = input.nameOverride
      }
      if (input.brandOverride !== undefined) {
        row.brandOverride = input.brandOverride
      }
      if (input.originOverride !== undefined) {
        row.originOverride = input.originOverride
      }
      if (input.abvOverride !== undefined) {
        row.abvOverride = input.abvOverride
      }
      if (input.volumeMlOverride !== undefined) {
        row.volumeMlOverride = input.volumeMlOverride
      }
      if (input.attrsOverride !== undefined) {
        const slug = row.bottle?.category?.slug ?? null
        row.attrsOverride = this.resolveWineAttrs(slug, row.attrsOverride, input.attrsOverride)
      }
      if (input.isPublic !== undefined) {
        row.isPublic = input.isPublic
      }

      if (entitlement && input.fillLevel !== undefined) {
        const nextLevel = input.fillLevel
        if (Number(row.fillLevel) !== nextLevel) {
          row.fillLevel = nextLevel
          row.fillLevelUpdatesCount = Number(row.fillLevelUpdatesCount) + 1
        }
      }

      if (entitlement && input.photoUrlOverride !== undefined) {
        row.photoUrlOverride = input.photoUrlOverride
      } else if (!entitlement && input.photoUrlOverride === null) {
        row.photoUrlOverride = null
      }

      await row.save()
      await row.load('bottle', (bottleQuery) => {
        bottleQuery.preload('category')
      })
      return row
    })
  }

  /**
   * Premium shelf photo. ≤ sync threshold: Sharp/HEIC inline.
   * Heavier files: inbox + `@adonisjs/queue` job (ProcessCellarPhoto).
   */
  async saveShelfPhoto(
    userId: number,
    id: number,
    file: MultipartFile
  ): Promise<{ row: UserBottle; processing: boolean }> {
    const entitlement = await this.entitlements.hasActiveEntitlement(userId)
    if (!entitlement) {
      throw this.premiumRequired('photoOverride')
    }

    const tmpPath = file.tmpPath
    if (!tmpPath) {
      throw new CollectionError('E_PHOTO_INVALID', 'Format ou taille de photo refusé', 422)
    }

    const input = await readFile(tmpPath)
    const storage = new CellarPhotoStorage()
    const syncMax = storage.syncMaxBytes()
    const heic = isHeicHeader(input.subarray(0, 16))
    const needsQueue = input.length > syncMax

    if (needsQueue) {
      const row = await this.findOwned(userId, id)
      const inboxPath = await storage.storeInbox(userId, row.id, input, heic ? 'heic' : 'bin')
      await ProcessCellarPhoto.dispatch({
        userId,
        userBottleId: row.id,
        inboxPath,
      })
      await row.load('bottle', (bottleQuery) => {
        bottleQuery.preload('category')
      })
      return { row, processing: true }
    }

    return db.transaction(async (trx) => {
      const row = await this.lockOwned(userId, id, trx)
      try {
        if (heic) {
          const processed = await new CellarPhotoProcessor().process(input, { forceEncode: true })
          const stored = await storage.storeOverrideBuffer(
            userId,
            row.id,
            processed.buffer,
            processed.ext
          )
          row.photoUrlOverride = stored.publicPath
        } else {
          const stored = await storage.storeOverride(userId, row.id, file)
          row.photoUrlOverride = stored.publicPath
        }
        await row.save()
      } catch (error) {
        if (!(error instanceof CollectionError)) {
          await storage.deleteOverride(userId, row.id)
        }
        throw error
      }
      await row.load('bottle', (bottleQuery) => {
        bottleQuery.preload('category')
      })
      return { row, processing: false }
    })
  }

  async delete(userId: number, id: number): Promise<void> {
    const row = await this.findOwned(userId, id)
    if (row.photoUrlOverride === overridePhotoPath(row.id)) {
      await new CellarPhotoStorage().deleteOverride(userId, row.id)
    }
    await row.delete()
  }

  /**
   * Bottle attrs override: wine keys (wine only) + optional `type` (any category).
   */
  private resolveWineAttrs(
    categorySlug: string | null,
    current: Record<string, unknown> | null,
    patch: BottleAttrsInput | null
  ): Record<string, unknown> | null {
    if (patch === null) {
      if (!isWineCategorySlug(categorySlug)) {
        const next: Record<string, unknown> = { ...(current ?? {}) }
        delete next[BOTTLE_TYPE_ATTR_KEY]
        return Object.keys(next).length ? next : null
      }
      return mergeWineAttrsOverride(current, null)
    }

    const winePatch: WineAttrsInput = {
      appellation: patch.appellation,
      grape: patch.grape,
      vintage: patch.vintage,
    }
    const hasWineKeys = WINE_ATTR_KEYS.some((key) =>
      Object.prototype.hasOwnProperty.call(patch, key)
    )
    const hasType = Object.prototype.hasOwnProperty.call(patch, BOTTLE_TYPE_ATTR_KEY)

    if (hasWineKeys && !isWineCategorySlug(categorySlug)) {
      throw new CollectionError(
        'E_WINE_ATTRS_CATEGORY',
        'Appellation, cépage et millésime sont réservés au vin',
        422
      )
    }

    let next: Record<string, unknown> | null = current ? { ...current } : null
    if (hasWineKeys && isWineCategorySlug(categorySlug)) {
      next = mergeWineAttrsOverride(next, winePatch)
    }
    if (hasType) {
      next = { ...(next ?? {}) }
      const raw = patch.type
      if (raw === null || raw === undefined || !String(raw).trim()) {
        delete next[BOTTLE_TYPE_ATTR_KEY]
      } else {
        next[BOTTLE_TYPE_ATTR_KEY] = String(raw).trim()
      }
    }
    if (!next || Object.keys(next).length === 0) {
      return null
    }
    return next
  }

  /**
   * Miss create may seed wine keys (wine only) + optional type onto the catalog row.
   */
  private resolveCatalogMissAttrs(
    categorySlug: string | null,
    attrs: BottleAttrsInput | Record<string, unknown> | undefined
  ): Record<string, unknown> {
    if (!attrs || Object.keys(attrs).length === 0) {
      return {}
    }
    const next: Record<string, unknown> = {}
    const hasWineKeys = WINE_ATTR_KEYS.some((key) =>
      Object.prototype.hasOwnProperty.call(attrs, key)
    )
    if (hasWineKeys && !isWineCategorySlug(categorySlug)) {
      throw new CollectionError(
        'E_WINE_ATTRS_CATEGORY',
        'Appellation, cépage et millésime sont réservés au vin',
        422
      )
    }
    if (isWineCategorySlug(categorySlug)) {
      for (const key of WINE_ATTR_KEYS) {
        const raw = (attrs as WineAttrsInput)[key as WineAttrKey]
        if (typeof raw !== 'string') {
          continue
        }
        const value = raw.trim()
        if (value) {
          next[key] = value
        }
      }
    }
    const typeRaw = (attrs as BottleAttrsInput).type
    if (typeof typeRaw === 'string' && typeRaw.trim()) {
      next[BOTTLE_TYPE_ATTR_KEY] = typeRaw.trim()
    }
    return next
  }

  private async lockOwned(
    userId: number,
    id: number,
    trx: TransactionClientContract
  ): Promise<UserBottle> {
    const row = await UserBottle.query({ client: trx })
      .where('id', id)
      .where('user_id', userId)
      .forUpdate()
      .first()

    if (!row) {
      throw new CollectionError(
        'E_USER_BOTTLE_NOT_FOUND',
        'Cette bouteille n’est pas dans ta cave',
        404
      )
    }

    row.useTransaction(trx)
    await row.load('bottle', (bottleQuery) => {
      bottleQuery.preload('category')
    })
    return row
  }

  /**
   * Catalog URLs are shown to every signed-in user. A relative `/api/` path
   * would be fetched with that viewer's bearer token.
   */
  private assertStoredPhotoUrls(
    input: { bottle?: { photoUrl?: string }; photoUrlOverride?: string | null },
    shelfId?: number
  ): void {
    const catalogUrl = input.bottle?.photoUrl
    if (catalogUrl && !isCatalogPhotoUrl(catalogUrl)) {
      throw new CollectionError('E_PHOTO_INVALID', 'URL de photo invalide', 422)
    }

    const override = input.photoUrlOverride
    if (override === undefined || override === null) {
      return
    }
    if (isHttpPhotoUrl(override)) {
      return
    }
    if (shelfId !== undefined && isOwnShelfPhotoUrl(override, shelfId)) {
      return
    }
    throw new CollectionError('E_PHOTO_INVALID', 'URL de photo invalide', 422)
  }

  private translateUnique(error: unknown): unknown {
    if (error instanceof CollectionError) {
      return error
    }
    const constraint = readPostgresUniqueViolation(error)
    if (constraint === 'bottles_barcode_active_unique') {
      return new CollectionError('E_BARCODE_EXISTS', 'Ce code-barres est déjà au catalogue', 409)
    }
    if (constraint && constraint.includes('user_id_bottle_id')) {
      return new CollectionError(
        'E_USER_BOTTLE_EXISTS',
        'Cette bouteille est déjà dans ta cave',
        409
      )
    }
    return error
  }

  private assertBottleCap(count: number, entitlement: boolean): void {
    if (entitlement) {
      return
    }
    if (count >= FREE_BOTTLE_LIMIT) {
      throw new CollectionError(
        'E_BOTTLE_LIMIT',
        'Cave pleine · passe premium pour continuer',
        403,
        {
          count,
          limit: FREE_BOTTLE_LIMIT,
          remaining: 0,
          entitlement: false,
        }
      )
    }
  }

  private assertPremiumWrites(
    entitlement: boolean,
    opts: {
      fillLevel?: number
      photoUrlOverride?: string | null
    }
  ): void {
    if (entitlement) {
      return
    }

    if (opts.fillLevel !== undefined) {
      // Free plan must leave server default untouched — any client-driven fillLevel is premium.
      throw this.premiumRequired('fillLevel')
    }

    if (opts.photoUrlOverride !== undefined && opts.photoUrlOverride !== null) {
      throw this.premiumRequired('photoOverride')
    }
  }

  private premiumRequired(feature: PremiumFeature): CollectionError {
    const messages: Record<PremiumFeature, string> = {
      fillLevel: 'La jauge de niveau est réservée aux comptes premium',
      photoOverride: 'La photo perso est réservée aux comptes premium',
    }
    return new CollectionError('E_PREMIUM_REQUIRED', messages[feature], 403, { feature })
  }
}
