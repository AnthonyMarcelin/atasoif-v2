import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'bottle_sources'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.increments('id').notNullable()
      table
        .integer('bottle_id')
        .unsigned()
        .notNullable()
        .references('id')
        .inTable('bottles')
        .onDelete('CASCADE')
      table.string('source').notNullable()
      table.string('external_id').notNullable()
      table.string('raw_hash').nullable()
      table.timestamp('last_synced_at').notNullable()
      table.timestamp('created_at').notNullable()

      table.unique(['source', 'external_id'])
      table.index(['bottle_id'])
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
