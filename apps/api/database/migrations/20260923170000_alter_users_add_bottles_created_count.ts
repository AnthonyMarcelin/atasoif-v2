import { BaseSchema } from '@adonisjs/lucid/schema'

/**
 * Lifetime freemium slots. Incremented on each successful UserBottle create.
 * Deletes must not decrement this column.
 * Backfill uses current rows: deletes that happened before this column are unknown.
 */
export default class extends BaseSchema {
  protected tableName = 'users'

  async up() {
    this.schema.alterTable(this.tableName, (table) => {
      table.integer('bottles_created_count').notNullable().defaultTo(0)
    })

    this.defer(async (db) => {
      await db.rawQuery(`
        UPDATE users AS u
        SET bottles_created_count = sub.total
        FROM (
          SELECT user_id, COUNT(*)::int AS total
          FROM user_bottles
          GROUP BY user_id
        ) AS sub
        WHERE u.id = sub.user_id
      `)
    })
  }

  async down() {
    this.schema.alterTable(this.tableName, (table) => {
      table.dropColumn('bottles_created_count')
    })
  }
}
