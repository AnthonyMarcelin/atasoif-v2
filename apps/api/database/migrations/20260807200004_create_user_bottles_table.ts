import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'user_bottles'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.increments('id').notNullable()
      table
        .integer('user_id')
        .unsigned()
        .notNullable()
        .references('id')
        .inTable('users')
        .onDelete('CASCADE')
      table
        .integer('bottle_id')
        .unsigned()
        .notNullable()
        .references('id')
        .inTable('bottles')
        .onDelete('RESTRICT')
      table.string('name_override').nullable()
      table.string('brand_override').nullable()
      table.string('origin_override').nullable()
      table.decimal('abv_override', 5, 2).nullable()
      table.integer('volume_ml_override').nullable()
      table.string('photo_url_override').nullable()
      table.jsonb('attrs_override').nullable()
      table.decimal('note', 3, 1).nullable()
      table.text('review').nullable()
      table.decimal('price_paid', 10, 2).nullable()
      table.string('bought_at').nullable()
      table.boolean('is_public').notNullable().defaultTo(false)
      table.timestamp('created_at').notNullable()
      table.timestamp('updated_at').nullable()

      table.unique(['user_id', 'bottle_id'])
      table.index(['user_id'])
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
