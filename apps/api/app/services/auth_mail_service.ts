import User from '#models/user'
import env from '#start/env'
import mail from '@adonisjs/mail/services/main'
import AuthTokenService from '#services/auth_token_service'
import VerifyEmailNotification from '#mails/verify_email_notification'
import PasswordResetNotification from '#mails/password_reset_notification'

/**
 * Sends verification and password-reset emails with FR copy and web deep links.
 */
export default class AuthMailService {
  async sendVerificationEmail(user: User) {
    const tokens = new AuthTokenService()
    const token = tokens.createEmailVerificationToken(user.id)
    const verifyUrl = `${env.get('WEB_URL')}/auth/verify-email?token=${encodeURIComponent(token)}`

    await mail.send(new VerifyEmailNotification(user, verifyUrl))
  }

  async sendPasswordResetEmail(user: User) {
    const tokens = new AuthTokenService()
    const token = tokens.createPasswordResetToken(user.id)
    const resetUrl = `${env.get('WEB_URL')}/auth/reset-password?token=${encodeURIComponent(token)}`

    await mail.send(new PasswordResetNotification(user, resetUrl))
  }
}
