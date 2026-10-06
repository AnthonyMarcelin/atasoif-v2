import type UserBottle from '#models/user_bottle'
import BottleTransformer from '#transformers/bottle_transformer'
import { BaseTransformer } from '@adonisjs/core/transformers'

export type UserBottleTransformOptions = {
  /** When true, omit memory / premium write fields (conversion §3). */
  locked?: boolean
}

/**
 * Personal cellar entry with catalog bottle + memory overrides (E2-T03).
 * Locked rows keep identity + catalog photo only.
 */
export default class UserBottleTransformer extends BaseTransformer<UserBottle> {
  toObject(options: UserBottleTransformOptions = {}) {
    const locked = Boolean(options.locked)
    const bottle = this.resource.bottle

    if (locked) {
      return {
        id: this.resource.id,
        userId: this.resource.userId,
        bottleId: this.resource.bottleId,
        nameOverride: this.resource.nameOverride,
        brandOverride: this.resource.brandOverride,
        originOverride: this.resource.originOverride,
        abvOverride:
          this.resource.abvOverride === null || this.resource.abvOverride === undefined
            ? null
            : Number(this.resource.abvOverride),
        volumeMlOverride: this.resource.volumeMlOverride,
        attrsOverride: this.resource.attrsOverride,
        isPublic: Boolean(this.resource.isPublic),
        locked: true as const,
        createdAt: this.resource.createdAt,
        updatedAt: this.resource.updatedAt,
        bottle: bottle ? new BottleTransformer(bottle).toObject() : null,
      }
    }

    return {
      id: this.resource.id,
      userId: this.resource.userId,
      bottleId: this.resource.bottleId,
      nameOverride: this.resource.nameOverride,
      brandOverride: this.resource.brandOverride,
      originOverride: this.resource.originOverride,
      abvOverride:
        this.resource.abvOverride === null || this.resource.abvOverride === undefined
          ? null
          : Number(this.resource.abvOverride),
      volumeMlOverride: this.resource.volumeMlOverride,
      photoUrlOverride: this.resource.photoUrlOverride,
      attrsOverride: this.resource.attrsOverride,
      note:
        this.resource.note === null || this.resource.note === undefined
          ? null
          : Number(this.resource.note),
      review: this.resource.review,
      pricePaid:
        this.resource.pricePaid === null || this.resource.pricePaid === undefined
          ? null
          : Number(this.resource.pricePaid),
      boughtAt: this.resource.boughtAt,
      fillLevel: this.resource.fillLevel,
      fillLevelUpdatesCount: this.resource.fillLevelUpdatesCount,
      isPublic: Boolean(this.resource.isPublic),
      locked: false as const,
      createdAt: this.resource.createdAt,
      updatedAt: this.resource.updatedAt,
      bottle: bottle ? new BottleTransformer(bottle).toObject() : null,
    }
  }
}
