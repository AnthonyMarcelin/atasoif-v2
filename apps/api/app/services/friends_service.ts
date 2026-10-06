import { randomBytes } from 'node:crypto'
import { Exception } from '@adonisjs/core/exceptions'
import mail from '@adonisjs/mail/services/main'
import env from '#start/env'
import Friendship from '#models/friendship'
import User from '#models/user'
import FriendRequestNotification from '#mails/friend_request_notification'
import UserBottle from '#models/user_bottle'
import { buildShareInviteUrl } from '#services/frontend_url'

export class FriendsError extends Exception {
  constructor(
    public code: string,
    message: string,
    status = 400
  ) {
    super(message, { status, code })
  }
}

function orderedPair(a: number, b: number): [number, number] {
  return a < b ? [a, b] : [b, a]
}

function inviteCode(): string {
  return randomBytes(4).toString('hex').toUpperCase().slice(0, 6)
}

export default class FriendsService {
  async ensureInviteCode(user: User): Promise<string> {
    if (user.inviteCode) {
      return user.inviteCode
    }
    for (let attempt = 0; attempt < 8; attempt++) {
      const code = inviteCode()
      const clash = await User.findBy('inviteCode', code)
      if (!clash) {
        user.inviteCode = code
        await user.save()
        return code
      }
    }
    throw new FriendsError('E_INVITE_CODE', 'Impossible de générer un code d’invitation', 500)
  }

  async listFor(userId: number) {
    const rows = await Friendship.query()
      .where((q) => {
        q.where('user_a_id', userId).orWhere('user_b_id', userId)
      })
      .whereIn('status', ['PENDING', 'ACCEPTED', 'BLOCKED'])
      .preload('userA')
      .preload('userB')
      .orderBy('updated_at', 'desc')

    const pending: Array<Record<string, unknown>> = []
    const friends: Array<Record<string, unknown>> = []
    const blocked: Array<Record<string, unknown>> = []

    for (const row of rows) {
      const other = row.userAId === userId ? row.userB : row.userA
      const bottleCount = await UserBottle.query().where('user_id', other.id).count('* as total')
      const count = Number(bottleCount[0].$extras.total)
      const payload = {
        id: row.id,
        status: row.status,
        requesterId: row.requesterId,
        user: {
          id: other.id,
          pseudo: other.pseudo,
          fullName: other.fullName,
          inviteCode: other.inviteCode,
        },
        bottleCount: count,
        cellarShared: Boolean(other.shareCellarWithFriends && row.status === 'ACCEPTED'),
        incoming: row.status === 'PENDING' && row.requesterId !== userId,
      }
      if (row.status === 'PENDING' && row.requesterId !== userId) {
        pending.push(payload)
      } else if (row.status === 'ACCEPTED') {
        friends.push(payload)
      } else if (row.status === 'BLOCKED') {
        blocked.push(payload)
      }
    }

    return { pending, friends, blocked }
  }

  /**
   * Invite by email or invite code / pseudo. Sends mail + creates PENDING friendship.
   */
  async invite(requesterId: number, target: string) {
    const requester = await User.findOrFail(requesterId)
    await this.ensureInviteCode(requester)

    const needle = target.trim()
    if (!needle) {
      throw new FriendsError('E_FRIEND_TARGET', 'Indique un email, un pseudo ou un code', 422)
    }

    let targetUser: User | null = null
    if (needle.includes('@')) {
      targetUser = await User.findBy('email', needle.toLowerCase())
    } else {
      targetUser =
        (await User.findBy('inviteCode', needle.toUpperCase())) ??
        (await User.findBy('pseudo', needle.replace(/^@/, '')))
    }

    if (!targetUser) {
      throw new FriendsError('E_FRIEND_NOT_FOUND', 'Personne trouvé avec ça', 404)
    }
    if (targetUser.id === requesterId) {
      throw new FriendsError('E_FRIEND_SELF', 'Tu ne peux pas t’ajouter toi-même', 422)
    }

    const [userAId, userBId] = orderedPair(requesterId, targetUser.id)
    const existing = await Friendship.query()
      .where('user_a_id', userAId)
      .where('user_b_id', userBId)
      .first()

    if (existing?.status === 'ACCEPTED') {
      throw new FriendsError('E_FRIEND_EXISTS', 'Vous êtes déjà amis', 409)
    }
    if (existing?.status === 'BLOCKED') {
      throw new FriendsError('E_FRIEND_BLOCKED', 'Cette relation est bloquée', 403)
    }
    if (existing?.status === 'PENDING') {
      throw new FriendsError('E_FRIEND_PENDING', 'Une demande est déjà en cours', 409)
    }

    const row = await Friendship.create({
      userAId,
      userBId,
      requesterId,
      status: 'PENDING',
    })

    const frontend = env.get('FRONTEND_URL').replace(/\/$/, '')
    const acceptUrl = `${frontend}/cave/amis?request=${row.id}`
    await mail.send(new FriendRequestNotification(targetUser, requester, acceptUrl))

    return row
  }

  async respond(userId: number, friendshipId: number, accept: boolean) {
    const row = await Friendship.find(friendshipId)
    if (!row || (row.userAId !== userId && row.userBId !== userId)) {
      throw new FriendsError('E_FRIEND_NOT_FOUND', 'Demande introuvable', 404)
    }
    if (row.status !== 'PENDING') {
      throw new FriendsError('E_FRIEND_STATE', 'Cette demande n’est plus en attente', 409)
    }
    if (row.requesterId === userId) {
      throw new FriendsError('E_FRIEND_SELF', 'Tu ne peux pas répondre à ta propre demande', 422)
    }

    if (accept) {
      row.status = 'ACCEPTED'
      await row.save()
      return row
    }

    await row.delete()
    return null
  }

  async block(userId: number, otherUserId: number) {
    if (userId === otherUserId) {
      throw new FriendsError('E_FRIEND_SELF', 'Action impossible', 422)
    }
    const [userAId, userBId] = orderedPair(userId, otherUserId)
    const existing = await Friendship.query()
      .where('user_a_id', userAId)
      .where('user_b_id', userBId)
      .first()
    if (existing) {
      existing.status = 'BLOCKED'
      existing.requesterId = userId
      await existing.save()
      return existing
    }
    return Friendship.create({
      userAId,
      userBId,
      requesterId: userId,
      status: 'BLOCKED',
    })
  }

  async unblock(userId: number, friendshipId: number) {
    const row = await Friendship.find(friendshipId)
    if (!row || (row.userAId !== userId && row.userBId !== userId)) {
      throw new FriendsError('E_FRIEND_NOT_FOUND', 'Blocage introuvable', 404)
    }
    if (row.status !== 'BLOCKED') {
      throw new FriendsError('E_FRIEND_STATE', 'Cette relation n’est pas bloquée', 409)
    }
    await row.delete()
  }

  async shareSettings(userId: number) {
    const user = await User.findOrFail(userId)
    const code = await this.ensureInviteCode(user)
    return {
      inviteCode: code,
      inviteUrl: buildShareInviteUrl(code),
      shareCellarWithFriends: user.shareCellarWithFriends,
      sharePrices: user.sharePrices,
      shareNotes: user.shareNotes,
      findableByPseudo: user.isPublic,
      pseudo: user.pseudo,
    }
  }

  async updateShareSettings(
    userId: number,
    patch: {
      shareCellarWithFriends?: boolean
      sharePrices?: boolean
      shareNotes?: boolean
      findableByPseudo?: boolean
    }
  ) {
    const user = await User.findOrFail(userId)
    if (patch.shareCellarWithFriends !== undefined) {
      user.shareCellarWithFriends = patch.shareCellarWithFriends
    }
    if (patch.sharePrices !== undefined) {
      user.sharePrices = patch.sharePrices
    }
    if (patch.shareNotes !== undefined) {
      user.shareNotes = patch.shareNotes
    }
    if (patch.findableByPseudo !== undefined) {
      user.isPublic = patch.findableByPseudo
    }
    await user.save()
    return this.shareSettings(userId)
  }
}
