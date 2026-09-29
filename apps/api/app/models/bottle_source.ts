import { DateTime } from 'luxon'
import { BaseModel, belongsTo, column } from '@adonisjs/lucid/orm'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'
import Bottle from '#models/bottle'

export default class BottleSource extends BaseModel {
  @column({ isPrimary: true })
  declare id: number

  @column()
  declare bottleId: number

  @column()
  declare source: string

  @column()
  declare externalId: string

  @column()
  declare rawHash: string | null

  @column.dateTime()
  declare lastSyncedAt: DateTime

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @belongsTo(() => Bottle)
  declare bottle: BelongsTo<typeof Bottle>
}
