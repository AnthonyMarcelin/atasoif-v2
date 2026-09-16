import { randomUUID } from 'node:crypto'
import User from '#models/user'

export type AllyProfile = {
  email: string | null
  name: string
  nickName: string
  avatarUrl?: string | null
  emailVerificationState: 'verified' | 'unverified' | 'unsupported'
}

export type SocialProvider = 'google' | 'facebook'

const EMAIL_MISSING_MESSAGE: Record<SocialProvider, string> = {
  google: 'Google n’a pas fourni d’e-mail',
  facebook: 'Facebook n’a pas fourni d’e-mail',
}

const EMAIL_UNVERIFIED_LINK_MESSAGE =
  'Confirme cet e-mail (lien reçu à l’inscription) avant de lier un compte social'

export type SocialAuthResult = {
  user: User
  /** True when this OAuth callback created the local row (not a link). */
  created: boolean
}

/**
 * Find or create a local user from an Ally social profile.
 * Matching key: normalized email (same address = same account as email/password signup).
 * Login only — never sync friends graphs from Meta.
 *
 * Security:
 * - Auto-link only when the local email is already verified, or the provider marks email verified.
 * - Unverified local accounts + verified OAuth email → reclaim (rotate password, revoke tokens).
 * - Unverified local + unverified/unsupported OAuth email → refuse (blocks pre-hijack squat).
 */
export default class SocialAuthService {
  async findOrCreateFromGoogle(profile: AllyProfile): Promise<SocialAuthResult> {
    return this.findOrCreateFromAlly(profile, 'google')
  }

  async findOrCreateFromFacebook(profile: AllyProfile): Promise<SocialAuthResult> {
    return this.findOrCreateFromAlly(profile, 'facebook')
  }

  async findOrCreateFromAlly(profile: AllyProfile, provider: SocialProvider): Promise<SocialAuthResult> {
    if (!profile.email) {
      throw new SocialAuthError('E_SOCIAL_EMAIL_REQUIRED', EMAIL_MISSING_MESSAGE[provider])
    }

    const email = profile.email.trim().toLowerCase()
    const providerEmailVerified = profile.emailVerificationState === 'verified'
    const existing = await User.findBy('email', email)

    if (existing) {
      const user = await this.linkExistingAccount(existing, profile, providerEmailVerified)
      return { user, created: false }
    }

    const pseudo = await this.allocatePseudo(profile.nickName || email.split('@')[0] || 'soif')

    const user = await User.create({
      email,
      fullName: profile.name || null,
      password: randomUUID(),
      pseudo,
      image: profile.avatarUrl ?? null,
      isPublic: false,
      emailVerified: providerEmailVerified,
    })

    return { user, created: true }
  }

  /**
   * Attach OAuth login to an existing email/password (or prior social) account.
   */
  private async linkExistingAccount(
    existing: User,
    profile: AllyProfile,
    providerEmailVerified: boolean
  ): Promise<User> {
    if (!existing.emailVerified && !providerEmailVerified) {
      throw new SocialAuthError('E_SOCIAL_EMAIL_UNVERIFIED', EMAIL_UNVERIFIED_LINK_MESSAGE)
    }

    let dirty = false

    if (!existing.emailVerified && providerEmailVerified) {
      // Squatted unverified signup: OAuth proves email ownership → reclaim.
      existing.password = randomUUID()
      existing.emailVerified = true
      dirty = true
      await existing.save()
      await User.accessTokens.deleteAll(existing)
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
