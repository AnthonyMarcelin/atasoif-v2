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

  /**
   * « Acheté chez » / purchase place (free text). Not a purchase date.
   * Required on create/update write path (E2-T03); nullable in DB for legacy rows.
   */
  @column()
  declare boughtAt: string | null

  /**
   * Bottle fill level (jauge), 0–100. Default 100 for all plans.
   * Mutating this field is premium (server gate in E2-T03).
   * Ops: finished = fillLevel === 0.
   */
  @column()
  declare fillLevel: number

  /** Thin counter for ops Habitudes « mises à jour de niveau » (incremented in T03+). */
  @column()
  declare fillLevelUpdatesCount: number

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
