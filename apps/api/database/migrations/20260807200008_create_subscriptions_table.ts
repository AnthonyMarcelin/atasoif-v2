import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'subscriptions'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.increments('id').notNullable()
      table
        .integer('user_id')
        .unsigned()
        .notNullable()
        .unique()
        .references('id')
        .inTable('users')
        .onDelete('CASCADE')
      table.string('plan').notNullable()
      table
        .enum('status', ['ACTIVE', 'PAST_DUE', 'CANCELED', 'EXPIRED'])
        .notNullable()
        .defaultTo('ACTIVE')
      table.string('provider').notNullable()
      table.string('provider_customer_id').nullable()
      table.string('provider_subscription_id').nullable()
      table.timestamp('current_period_end').nullable()
      table.timestamp('created_at').notNullable()
      table.timestamp('updated_at').nullable()
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
