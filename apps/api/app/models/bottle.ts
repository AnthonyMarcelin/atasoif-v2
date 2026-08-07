import { DateTime } from 'luxon'
import { BaseModel, belongsTo, column, hasMany } from '@adonisjs/lucid/orm'
import type { BelongsTo, HasMany } from '@adonisjs/lucid/types/relations'
import Category from '#models/category'
import BottleSource from '#models/bottle_source'
import UserBottle from '#models/user_bottle'

export default class Bottle extends BaseModel {
  @column({ isPrimary: true })
  declare id: number

  @column()
  declare name: string

  @column()
  declare brand: string | null

  @column()
  declare origin: string | null

  @column()
  declare abv: number | null

  @column()
  declare volumeMl: number | null

  @column()
  declare barcode: string | null

  @column()
  declare photoUrl: string | null

  @column()
  declare attrs: Record<string, unknown>

  @column()
  declare categoryId: number

  @column.dateTime()
  declare deletedAt: DateTime | null

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime | null

  @belongsTo(() => Category)
  declare category: BelongsTo<typeof Category>

  @hasMany(() => BottleSource)
  declare sources: HasMany<typeof BottleSource>

  @hasMany(() => UserBottle)
  declare userBottles: HasMany<typeof UserBottle>
}
