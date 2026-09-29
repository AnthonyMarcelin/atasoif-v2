import { DateTime } from 'luxon'
import { BaseModel, belongsTo, column } from '@adonisjs/lucid/orm'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'
import User from '#models/user'

export default class Subscription extends BaseModel {
  @column({ isPrimary: true })
  declare id: number

  @column()
  declare userId: number

  @column()
  declare plan: string

  @column()
  declare status: 'ACTIVE' | 'PAST_DUE' | 'CANCELED' | 'EXPIRED'

  @column()
  declare provider: string

  @column()
  declare providerCustomerId: string | null

  @column()
  declare providerSubscriptionId: string | null

  @column.dateTime()
  declare currentPeriodEnd: DateTime | null

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime | null

  @belongsTo(() => User)
  declare user: BelongsTo<typeof User>
}
