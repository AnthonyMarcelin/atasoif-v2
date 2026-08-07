import { UserSchema } from '#database/schema'
import hash from '@adonisjs/core/services/hash'
import { compose } from '@adonisjs/core/helpers'
import { withAuthFinder } from '@adonisjs/auth/mixins/lucid'
import { type AccessToken, DbAccessTokensProvider } from '@adonisjs/auth/access_tokens'
import { column, hasMany, hasOne } from '@adonisjs/lucid/orm'
import type { HasMany, HasOne } from '@adonisjs/lucid/types/relations'
import UserBottle from '#models/user_bottle'
import Subscription from '#models/subscription'

export default class User extends compose(UserSchema, withAuthFinder(hash)) {
  static accessTokens = DbAccessTokensProvider.forModel(User)
  declare currentAccessToken?: AccessToken

  @column()
  declare pseudo: string | null

  @column()
  declare isPublic: boolean

  @column()
  declare image: string | null

  @column()
  declare emailVerified: boolean

  @hasMany(() => UserBottle)
  declare bottles: HasMany<typeof UserBottle>

  @hasOne(() => Subscription)
  declare subscription: HasOne<typeof Subscription>

  get initials() {
    const [first, last] = this.fullName ? this.fullName.split(' ') : this.email.split('@')
    if (first && last) {
      return `${first.charAt(0)}${last.charAt(0)}`.toUpperCase()
    }
    return `${first.slice(0, 2)}`.toUpperCase()
  }
}
