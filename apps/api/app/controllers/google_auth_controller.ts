import User from '#models/user'
import AuthEmailTokenService from '#services/auth_email_token_service'
import SocialAuthService, { SocialAuthError } from '#services/social_auth_service'
import VerifyEmailNotification from '#mails/verify_email_notification'
import {
  buildFrontendOAuthRedirect,
  buildFrontendLoginErrorRedirect,
  buildFrontendUrl,
} from '#services/frontend_url'
import type { HttpContext } from '@adonisjs/core/http'
import mail from '@adonisjs/mail/services/main'

/**
 * Google OAuth via Ally → Adonis access token → redirect to Angular.
 */
export default class GoogleAuthController {
  /**
   * Start Google OAuth (browser redirect).
   */
  async redirect({ ally }: HttpContext) {
    return ally.use('google').redirect((request) => {
      request.scopes(['openid', 'userinfo.email', 'userinfo.profile'])
      request.param('prompt', 'select_account')
    })
  }

  /**
   * Google callback: find/create user, issue Bearer token, send browser to the SPA.
   */
  async callback({ ally, response }: HttpContext) {
    const google = ally.use('google')

    if (google.accessDenied()) {
      return response.redirect(buildFrontendLoginErrorRedirect('google_denied'))
    }

    if (google.stateMisMatch()) {
      return response.redirect(buildFrontendLoginErrorRedirect('google_state'))
    }

    if (google.hasError()) {
      return response.redirect(buildFrontendLoginErrorRedirect('google_error'))
    }

    const googleUser = await google.user()

    try {
      const social = new SocialAuthService()
      const { user, created } = await social.findOrCreateFromGoogle({
        email: googleUser.email,
        name: googleUser.name,
        nickName: googleUser.nickName,
        avatarUrl: googleUser.avatarUrl,
        emailVerificationState: googleUser.emailVerificationState,
      })

      if (created && !user.emailVerified) {
        await sendSocialVerificationEmail(user)
      }

      const token = await User.accessTokens.create(user)
      return response.redirect(buildFrontendOAuthRedirect(token.value!.release()))
    } catch (error) {
      if (error instanceof SocialAuthError) {
        const code =
          error.code === 'E_SOCIAL_EMAIL_UNVERIFIED' ? 'google_unverified' : 'google_email'
        return response.redirect(buildFrontendLoginErrorRedirect(code))
      }
      throw error
    }
  }
}

async function sendSocialVerificationEmail(user: User) {
  const tokens = new AuthEmailTokenService()
  const verificationToken = tokens.createEmailVerificationToken(user.id)
  const verifyUrl = buildFrontendUrl('/auth/verify-email', verificationToken)
  await mail.send(new VerifyEmailNotification(user, verifyUrl))
}
