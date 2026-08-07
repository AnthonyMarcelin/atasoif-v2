import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'friendships'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.increments('id').notNullable()
      table
        .integer('user_a_id')
        .unsigned()
        .notNullable()
        .references('id')
        .inTable('users')
        .onDelete('CASCADE')
      table
        .integer('user_b_id')
        .unsigned()
        .notNullable()
        .references('id')
        .inTable('users')
        .onDelete('CASCADE')
      table
        .enum('status', ['PENDING', 'ACCEPTED', 'BLOCKED'])
        .notNullable()
        .defaultTo('PENDING')
      table.timestamp('created_at').notNullable()
      table.timestamp('updated_at').nullable()

      table.unique(['user_a_id', 'user_b_id'])
      table.index(['user_b_id'])
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
