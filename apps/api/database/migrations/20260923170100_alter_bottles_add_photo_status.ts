import { BaseSchema } from '@adonisjs/lucid/schema'

/**
 * User-contributed catalog packshots start as `pending`.
 * `approved` is reserved for a later moderation pass. No admin UI here.
 * Null means the photo was not a user contribution (seed, OFF, or no photo).
 */
export default class extends BaseSchema {
  protected tableName = 'bottles'

  async up() {
    this.schema.alterTable(this.tableName, (table) => {
      table.string('photo_status', 16).nullable()
    })
  }

  async down() {
    this.schema.alterTable(this.tableName, (table) => {
      table.dropColumn('photo_status')
    })
  }
}
