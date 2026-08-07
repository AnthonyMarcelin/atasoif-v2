import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'users'

  async up() {
    this.schema.alterTable(this.tableName, (table) => {
      table.string('pseudo', 100).nullable().unique()
      table.boolean('is_public').notNullable().defaultTo(false)
      table.string('image').nullable()
      table.boolean('email_verified').notNullable().defaultTo(false)
    })
  }

  async down() {
    this.schema.alterTable(this.tableName, (table) => {
      table.dropColumn('pseudo')
      table.dropColumn('is_public')
      table.dropColumn('image')
      table.dropColumn('email_verified')
    })
  }
}
