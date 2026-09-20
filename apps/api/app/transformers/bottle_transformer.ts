import type Bottle from '#models/bottle'
import { BaseTransformer } from '@adonisjs/core/transformers'

/**
 * Catalog bottle shape for add-flow prefill (E2-T02 / E2-T07).
 */
export default class BottleTransformer extends BaseTransformer<Bottle> {
  toObject() {
    const category = this.resource.category
    return {
      id: this.resource.id,
      name: this.resource.name,
      brand: this.resource.brand,
      origin: this.resource.origin,
      abv: this.resource.abv === null || this.resource.abv === undefined ? null : Number(this.resource.abv),
      volumeMl: this.resource.volumeMl,
      barcode: this.resource.barcode,
      photoUrl: this.resource.photoUrl,
      attrs: this.resource.attrs ?? {},
      categoryId: this.resource.categoryId,
      category: category
        ? {
            id: category.id,
            slug: category.slug,
            name: category.name,
          }
        : null,
    }
  }
}
