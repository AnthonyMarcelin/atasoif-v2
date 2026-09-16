import encryption from '@adonisjs/core/services/encryption'

const EMAIL_VERIFICATION_PURPOSE = 'email-verification'
const PASSWORD_RESET_PURPOSE = 'password-reset'

type EmailVerificationPayload = {
  userId: number
}

type PasswordResetPayload = {
  userId: number
  /** Must match `users.password_reset_version` or the token is rejected (single-use / rotate). */
  version: number
}

/**
 * Purpose-bound encrypted tokens for email verification and password reset.
 * @see https://docs.adonisjs.com/guides/security/encryption
 */
export default class AuthEmailTokenService {
  createEmailVerificationToken(userId: number): string {
    return encryption.encrypt({ userId } satisfies EmailVerificationPayload, {
      expiresIn: '48h',
      purpose: EMAIL_VERIFICATION_PURPOSE,
    })
  }

  verifyEmailVerificationToken(token: string): EmailVerificationPayload | null {
    return encryption.decrypt<EmailVerificationPayload>(token, EMAIL_VERIFICATION_PURPOSE)
  }

  createPasswordResetToken(userId: number, version: number): string {
    return encryption.encrypt({ userId, version } satisfies PasswordResetPayload, {
      expiresIn: '1h',
      purpose: PASSWORD_RESET_PURPOSE,
    })
  }

  verifyPasswordResetToken(token: string): PasswordResetPayload | null {
    const payload = encryption.decrypt<PasswordResetPayload>(token, PASSWORD_RESET_PURPOSE)
    if (!payload || typeof payload.userId !== 'number' || typeof payload.version !== 'number') {
      return null
    }
    return payload
  }
}
