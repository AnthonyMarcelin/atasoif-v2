import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'messages'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.increments('id').notNullable()
      table
        .integer('sender_id')
        .unsigned()
        .notNullable()
        .references('id')
        .inTable('users')
        .onDelete('CASCADE')
      table
        .integer('receiver_id')
        .unsigned()
        .notNullable()
        .references('id')
        .inTable('users')
        .onDelete('CASCADE')
      table.text('body').notNullable()
      table.timestamp('read_at').nullable()
      table.timestamp('created_at').notNullable()

      table.index(['sender_id', 'receiver_id'])
      table.index(['receiver_id'])
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
