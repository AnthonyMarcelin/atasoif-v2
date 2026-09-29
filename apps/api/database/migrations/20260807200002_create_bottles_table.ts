import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'bottles'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.increments('id').notNullable()
      table.string('name').notNullable()
      table.string('brand').nullable()
      table.string('origin').nullable()
      table.decimal('abv', 5, 2).nullable()
      table.integer('volume_ml').nullable()
      table.string('barcode').nullable().index()
      table.string('photo_url').nullable()
      table.jsonb('attrs').notNullable().defaultTo('{}')
      table
        .integer('category_id')
        .unsigned()
        .notNullable()
        .references('id')
        .inTable('categories')
        .onDelete('RESTRICT')
      table.timestamp('deleted_at').nullable()
      table.timestamp('created_at').notNullable()
      table.timestamp('updated_at').nullable()

      table.index(['name'])
      table.index(['brand'])
      table.index(['category_id'])
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
