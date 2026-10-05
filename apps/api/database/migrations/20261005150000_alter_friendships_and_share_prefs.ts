import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  async up() {
    this.schema.alterTable('friendships', (table) => {
      table
        .integer('requester_id')
        .unsigned()
        .nullable()
        .references('id')
        .inTable('users')
        .onDelete('CASCADE')
      table.index(['requester_id'])
    })

    this.schema.alterTable('users', (table) => {
      table.string('invite_code', 16).nullable().unique()
      table.boolean('share_cellar_with_friends').notNullable().defaultTo(true)
      table.boolean('share_prices').notNullable().defaultTo(false)
      table.boolean('share_notes').notNullable().defaultTo(true)
      table.integer('magic_link_version').unsigned().notNullable().defaultTo(0)
    })
  }

  async down() {
    this.schema.alterTable('friendships', (table) => {
      table.dropColumn('requester_id')
    })
    this.schema.alterTable('users', (table) => {
      table.dropColumn('invite_code')
      table.dropColumn('share_cellar_with_friends')
      table.dropColumn('share_prices')
      table.dropColumn('share_notes')
      table.dropColumn('magic_link_version')
    })
  }
}
