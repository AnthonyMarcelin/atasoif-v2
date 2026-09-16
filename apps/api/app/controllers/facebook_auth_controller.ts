import User from '#models/user'
import SocialAuthService, { SocialAuthError } from '#services/social_auth_service'
import { buildFrontendOAuthRedirect, buildFrontendLoginErrorRedirect } from '#services/frontend_url'
import type { HttpContext } from '@adonisjs/core/http'

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
      const user = await social.findOrCreateFromFacebook({
        email: facebookUser.email,
        name: facebookUser.name,
        nickName: facebookUser.nickName,
        avatarUrl: facebookUser.avatarUrl,
        emailVerificationState: facebookUser.emailVerificationState,
      })

      const token = await User.accessTokens.create(user)
      return response.redirect(buildFrontendOAuthRedirect(token.value!.release()))
    } catch (error) {
      if (error instanceof SocialAuthError) {
        return response.redirect(buildFrontendLoginErrorRedirect('facebook_email'))
      }
      throw error
    }
  }
}
