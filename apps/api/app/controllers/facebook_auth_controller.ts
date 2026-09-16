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
 * Facebook OAuth via Ally → Adonis access token → redirect to Angular.
 * Login only — no Meta friends graph / social import (E6 stays in-app).
 */
export default class FacebookAuthController {
  /**
   * Start Facebook OAuth (browser redirect).
   * Scopes limited to email + public_profile (never user_friends).
   */
  async redirect({ ally }: HttpContext) {
    return ally.use('facebook').redirect((request) => {
      request.scopes(['email', 'public_profile'])
    })
  }

  /**
   * Facebook callback: find/create user, issue Bearer token, send browser to the SPA.
   */
  async callback({ ally, response }: HttpContext) {
    const facebook = ally.use('facebook')

    if (facebook.accessDenied()) {
      return response.redirect(buildFrontendLoginErrorRedirect('facebook_denied'))
    }

    if (facebook.stateMisMatch()) {
      return response.redirect(buildFrontendLoginErrorRedirect('facebook_state'))
    }

    if (facebook.hasError()) {
      return response.redirect(buildFrontendLoginErrorRedirect('facebook_error'))
    }

    const facebookUser = await facebook.user()

    try {
      const social = new SocialAuthService()
      const { user, created } = await social.findOrCreateFromFacebook({
        email: facebookUser.email,
        name: facebookUser.name,
        nickName: facebookUser.nickName,
        avatarUrl: facebookUser.avatarUrl,
        emailVerificationState: facebookUser.emailVerificationState,
      })

      if (created && !user.emailVerified) {
        await sendSocialVerificationEmail(user)
      }

      const token = await User.accessTokens.create(user)
      return response.redirect(buildFrontendOAuthRedirect(token.value!.release()))
    } catch (error) {
      if (error instanceof SocialAuthError) {
        const code =
          error.code === 'E_SOCIAL_EMAIL_UNVERIFIED' ? 'facebook_unverified' : 'facebook_email'
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
