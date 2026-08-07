import { DateTime } from 'luxon'
import { BaseModel, belongsTo, column } from '@adonisjs/lucid/orm'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'
import Bottle from '#models/bottle'
import User from '#models/user'

export default class UserBottle extends BaseModel {
  @column({ isPrimary: true })
  declare id: number

  @column()
  declare userId: number

  @column()
  declare bottleId: number

  @column()
  declare nameOverride: string | null

  @column()
  declare brandOverride: string | null

  @column()
  declare originOverride: string | null

  @column()
  declare abvOverride: number | null

  @column()
  declare volumeMlOverride: number | null

  @column()
  declare photoUrlOverride: string | null

  @column()
  declare attrsOverride: Record<string, unknown> | null

  @column()
  declare note: number | null

  @column()
  declare review: string | null

  @column()
  declare pricePaid: number | null

  @column()
  declare boughtAt: string | null

  @column()
  declare isPublic: boolean

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime | null

  @belongsTo(() => User)
  declare user: BelongsTo<typeof User>

  @belongsTo(() => Bottle)
  declare bottle: BelongsTo<typeof Bottle>
}
