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
 * Sign in with Apple via custom Ally driver → Adonis access token → Angular.
 * Callback is POST (Apple form_post) and also accepts GET for parity with Google.
 */
export default class AppleAuthController {
  /**
   * Start Apple OAuth (browser redirect).
   */
  async redirect({ ally }: HttpContext) {
    return ally.use('apple').redirect((request) => {
      request.scopes(['name', 'email'])
    })
  }

  /**
   * Apple callback: find/create user, issue Bearer token, send browser to the SPA.
   */
  async callback({ ally, response }: HttpContext) {
    const apple = ally.use('apple')

    if (apple.accessDenied()) {
      return response.redirect(buildFrontendLoginErrorRedirect('apple_denied'))
    }

    if (apple.stateMisMatch()) {
      return response.redirect(buildFrontendLoginErrorRedirect('apple_state'))
    }

    if (apple.hasError()) {
      return response.redirect(buildFrontendLoginErrorRedirect('apple_error'))
    }

    const appleUser = await apple.user()

    try {
      const social = new SocialAuthService()
      const { user, created } = await social.findOrCreateFromApple({
        email: appleUser.email,
        name: appleUser.name,
        nickName: appleUser.nickName,
        avatarUrl: appleUser.avatarUrl,
        emailVerificationState: appleUser.emailVerificationState,
      })

      if (created && !user.emailVerified) {
        await sendSocialVerificationEmail(user)
      }

      const token = await User.accessTokens.create(user)
      return response.redirect(buildFrontendOAuthRedirect(token.value!.release()))
    } catch (error) {
      if (error instanceof SocialAuthError) {
        const code =
          error.code === 'E_SOCIAL_EMAIL_UNVERIFIED' ? 'apple_unverified' : 'apple_email'
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
