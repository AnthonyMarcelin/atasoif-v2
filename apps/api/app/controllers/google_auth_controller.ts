import User from '#models/user'
import SocialAuthService, { SocialAuthError } from '#services/social_auth_service'
import { buildFrontendOAuthRedirect, buildFrontendLoginErrorRedirect } from '#services/frontend_url'
import type { HttpContext } from '@adonisjs/core/http'

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
      const user = await social.findOrCreateFromGoogle({
        email: googleUser.email,
        name: googleUser.name,
        nickName: googleUser.nickName,
        avatarUrl: googleUser.avatarUrl,
        emailVerificationState: googleUser.emailVerificationState,
      })

      const token = await User.accessTokens.create(user)
      return response.redirect(buildFrontendOAuthRedirect(token.value!.release()))
    } catch (error) {
      if (error instanceof SocialAuthError) {
        return response.redirect(buildFrontendLoginErrorRedirect('google_email'))
      }
      throw error
    }
  }
}
