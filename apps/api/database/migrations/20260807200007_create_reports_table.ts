import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'reports'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.increments('id').notNullable()
      table
        .integer('reporter_id')
        .unsigned()
        .notNullable()
        .references('id')
        .inTable('users')
        .onDelete('CASCADE')
      table.string('target_type').notNullable()
      table.string('target_id').notNullable()
      table.string('reason').notNullable()
      table.timestamp('created_at').notNullable()

      table.index(['target_type', 'target_id'])
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
