import type UserBottle from '#models/user_bottle'
import BottleTransformer from '#transformers/bottle_transformer'
import { BaseTransformer } from '@adonisjs/core/transformers'

/**
 * Personal cellar entry with catalog bottle + memory overrides (E2-T03).
 */
export default class UserBottleTransformer extends BaseTransformer<UserBottle> {
  toObject() {
    const bottle = this.resource.bottle
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
      createdAt: this.resource.createdAt,
      updatedAt: this.resource.updatedAt,
      bottle: bottle ? new BottleTransformer(bottle).toObject() : null,
    }
  }
}
