import encryption from '@adonisjs/core/services/encryption'

const EMAIL_VERIFICATION_PURPOSE = 'email-verification'
const PASSWORD_RESET_PURPOSE = 'password-reset'

type TokenPayload = {
  userId: number
}

/**
 * Purpose-bound encrypted tokens for email verification and password reset.
 * @see https://docs.adonisjs.com/guides/security/encryption
 */
export default class AuthTokenService {
  createEmailVerificationToken(userId: number) {
    return encryption.encrypt({ userId } satisfies TokenPayload, {
      expiresIn: '48h',
      purpose: EMAIL_VERIFICATION_PURPOSE,
    })
  }

  verifyEmailVerificationToken(token: string): TokenPayload | null {
    return encryption.decrypt<TokenPayload>(token, EMAIL_VERIFICATION_PURPOSE)
  }

  createPasswordResetToken(userId: number) {
    return encryption.encrypt({ userId } satisfies TokenPayload, {
      expiresIn: '1h',
      purpose: PASSWORD_RESET_PURPOSE,
    })
  }

  verifyPasswordResetToken(token: string): TokenPayload | null {
    return encryption.decrypt<TokenPayload>(token, PASSWORD_RESET_PURPOSE)
  }
}
