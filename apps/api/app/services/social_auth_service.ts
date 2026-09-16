import { randomUUID } from 'node:crypto'
import User from '#models/user'

export type AllyProfile = {
  email: string | null
  name: string
  nickName: string
  avatarUrl?: string | null
  emailVerificationState: 'verified' | 'unverified' | 'unsupported'
}

/**
 * Find or create a local user from an Ally social profile.
 * Matching key: email (same address = same account as email/password signup).
 */
export default class SocialAuthService {
  async findOrCreateFromGoogle(profile: AllyProfile): Promise<User> {
    if (!profile.email) {
      throw new SocialAuthError('E_SOCIAL_EMAIL_REQUIRED', 'Google n’a pas fourni d’e-mail')
    }

    const email = profile.email.trim().toLowerCase()
    const emailVerified = profile.emailVerificationState === 'verified'
    const existing = await User.findBy('email', email)

    if (existing) {
      let dirty = false
      if (emailVerified && !existing.emailVerified) {
        existing.emailVerified = true
        dirty = true
      }
      if (!existing.fullName && profile.name) {
        existing.fullName = profile.name
        dirty = true
      }
      if (!existing.image && profile.avatarUrl) {
        existing.image = profile.avatarUrl
        dirty = true
      }
      if (dirty) {
        await existing.save()
      }
      return existing
    }

    const pseudo = await this.allocatePseudo(profile.nickName || email.split('@')[0] || 'soif')

    return User.create({
      email,
      fullName: profile.name || null,
      password: randomUUID(),
      pseudo,
      image: profile.avatarUrl ?? null,
      isPublic: false,
      emailVerified,
    })
  }

  /**
   * Build a unique pseudo within signup/profile charset rules.
   */
  async allocatePseudo(raw: string): Promise<string> {
    const base = raw
      .normalize('NFKD')
      .replace(/[^\w.-]+/g, '_')
      .replace(/_+/g, '_')
      .replace(/^[._-]+|[._-]+$/g, '')
      .slice(0, 28)

    let candidate = (base.length >= 2 ? base : `soif_${base || 'user'}`).slice(0, 32)

    for (let i = 0; i < 20; i++) {
      const taken = await User.findBy('pseudo', candidate)
      if (!taken) {
        return candidate
      }
      const suffix = String(i + 2)
      candidate = `${candidate.slice(0, Math.max(2, 32 - suffix.length))}${suffix}`
    }

    return `soif_${randomUUID().replace(/-/g, '').slice(0, 12)}`
  }
}

export class SocialAuthError extends Error {
  constructor(
    readonly code: string,
    message: string
  ) {
    super(message)
    this.name = 'SocialAuthError'
  }
}
