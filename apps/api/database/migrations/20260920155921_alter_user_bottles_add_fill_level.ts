import { BaseSchema } from '@adonisjs/lucid/schema'

/**
 * E2-T01 — jauge (fill level) on personal cellar rows.
 *
 * `bought_at` already stores « Acheté chez » / place (free text). Do not add
 * a second place column. Purchase date is not modeled separately yet.
 *
 * Freemium: column present for all plans (default 100). Mutating fill_level
 * is premium — enforced in E2-T03, not here.
 * Ops: finished bottle = fill_level === 0; fill_level_updates_count feeds Habitudes.
 */
export default class extends BaseSchema {
  protected tableName = 'user_bottles'

  async up() {
    this.schema.alterTable(this.tableName, (table) => {
      table.integer('fill_level').notNullable().defaultTo(100)
      table.integer('fill_level_updates_count').notNullable().defaultTo(0)
    })
  }

  async down() {
    this.schema.alterTable(this.tableName, (table) => {
      table.dropColumn('fill_level')
      table.dropColumn('fill_level_updates_count')
    })
  }
}
