import { DateTime } from 'luxon'
import db from '@adonisjs/lucid/services/db'
import { BOTTLE_SOURCES, FILL_LEVEL_DEFAULT, FREE_BOTTLE_LIMIT } from '@atasoif/shared'
import Bottle from '#models/bottle'
import BottleSource from '#models/bottle_source'
import Category from '#models/category'
import User from '#models/user'
import UserBottle from '#models/user_bottle'
import CellarPhotoStorage, { overridePhotoPath } from '#services/cellar_photo_storage'
import { CollectionError } from '#services/collection/collection_error'
import EntitlementService from '#services/entitlement_service'

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

type CreateBottleMiss = {
  name: string
  brand?: string
  origin?: string
  abv?: number
  volumeMl?: number
  barcode?: string
  photoUrl?: string
  categoryId: number
  attrs?: Record<string, unknown>
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

    return db.transaction(async (trx) => {
      const locked = await trx
        .from('users')
        .where('id', userId)
        .forUpdate()
        .select('bottles_created_count')
        .first()
      const createdCount = Number(locked?.bottles_created_count ?? 0)
      this.assertBottleCap(createdCount, entitlement)

      let bottleId = input.bottleId

      if (hasMiss && input.bottle) {
        const category = await Category.find(input.bottle.categoryId, { client: trx })
        if (!category) {
          throw new CollectionError('E_CATEGORY_NOT_FOUND', 'Catégorie introuvable', 422)
        }

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
            attrs: input.bottle.attrs ?? {},
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
      }

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
  }

  async update(userId: number, id: number, input: UpdateUserBottleInput): Promise<UserBottle> {
    const entitlement = await this.entitlements.hasActiveEntitlement(userId)
    const row = await this.findOwned(userId, id)

    this.assertPremiumWrites(entitlement, {
      fillLevel: input.fillLevel,
      photoUrlOverride: input.photoUrlOverride,
    })

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
    if (input.isPublic !== undefined) {
      row.isPublic = input.isPublic
    }

    if (entitlement && input.fillLevel !== undefined) {
      if (row.fillLevel !== input.fillLevel) {
        row.fillLevel = input.fillLevel
        row.fillLevelUpdatesCount = row.fillLevelUpdatesCount + 1
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
  }

  /**
   * Owner + premium gate for a shelf photo. Does not write the file.
   */
  async preparePhotoOverride(userId: number, id: number): Promise<UserBottle> {
    const row = await this.findOwned(userId, id)
    const entitlement = await this.entitlements.hasActiveEntitlement(userId)
    if (!entitlement) {
      throw this.premiumRequired('photoOverride')
    }
    return row
  }

  async delete(userId: number, id: number): Promise<void> {
    const row = await this.findOwned(userId, id)
    if (row.photoUrlOverride === overridePhotoPath(row.id)) {
      await new CellarPhotoStorage().deleteOverride(userId, row.id)
    }
    await row.delete()
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
