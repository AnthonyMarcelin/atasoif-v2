import User from '#models/user'
import AuthEmailTokenService from '#services/auth_email_token_service'
import SocialAuthService, { SocialAuthError } from '#services/social_auth_service'
import VerifyEmailNotification from '#mails/verify_email_notification'
import {
  buildFrontendOAuthRedirect,
  buildFrontendLoginErrorRedirect,
  buildFrontendUrl,
} from '#services/frontend_url'
import {
  consumeOAuthReturnClient,
  rememberOAuthReturnClient,
} from '#services/oauth_return_client'
import type { HttpContext } from '@adonisjs/core/http'
import mail from '@adonisjs/mail/services/main'

/**
 * Sign in with Apple via custom Ally driver → Adonis access token → Angular / Capacitor.
 * Callback is POST (Apple form_post) and also accepts GET for parity with Google.
 * Native Capacitor: start with `?client=native` → return via NATIVE_OAUTH_RETURN_URL.
 */
export default class AppleAuthController {
  /**
   * Start Apple OAuth (browser / ASWebAuthenticationSession).
   */
  async redirect(ctx: HttpContext) {
    rememberOAuthReturnClient(ctx)
    return ctx.ally.use('apple').redirect((request) => {
      request.scopes(['name', 'email'])
    })
  }

  /**
   * Apple callback: find/create user, issue Bearer token, send browser back to client.
   */
  async callback(ctx: HttpContext) {
    const { ally, response } = ctx
    const client = consumeOAuthReturnClient(ctx)
    const apple = ally.use('apple')

    if (apple.accessDenied()) {
      return response.redirect(buildFrontendLoginErrorRedirect('apple_denied', client))
    }

    if (apple.stateMisMatch()) {
      return response.redirect(buildFrontendLoginErrorRedirect('apple_state', client))
    }

    if (apple.hasError()) {
      return response.redirect(buildFrontendLoginErrorRedirect('apple_error', client))
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
      return response.redirect(buildFrontendOAuthRedirect(token.value!.release(), client))
    } catch (error) {
      if (error instanceof SocialAuthError) {
        const code =
          error.code === 'E_SOCIAL_EMAIL_UNVERIFIED' ? 'apple_unverified' : 'apple_email'
        return response.redirect(buildFrontendLoginErrorRedirect(code, client))
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
