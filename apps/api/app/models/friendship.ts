import { BaseModel, belongsTo, column } from '@adonisjs/lucid/orm'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'
import { DateTime } from 'luxon'
import User from '#models/user'

export type FriendshipStatus = 'PENDING' | 'ACCEPTED' | 'BLOCKED'

export default class Friendship extends BaseModel {
  static table = 'friendships'

  @column({ isPrimary: true })
  declare id: number

  @column()
  declare userAId: number

  @column()
  declare userBId: number

  @column()
  declare requesterId: number | null

  @column()
  declare status: FriendshipStatus

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime | null

  @belongsTo(() => User, { foreignKey: 'userAId' })
  declare userA: BelongsTo<typeof User>

  @belongsTo(() => User, { foreignKey: 'userBId' })
  declare userB: BelongsTo<typeof User>

  @belongsTo(() => User, { foreignKey: 'requesterId' })
  declare requester: BelongsTo<typeof User>
}
