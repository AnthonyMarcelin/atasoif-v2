/* eslint-disable prettier/prettier */
import type { routes } from './index.ts'

export interface ApiDefinition {
  health: typeof routes['health']
  auth: {
    newAccount: {
      store: typeof routes['auth.new_account.store']
    }
    accessTokens: {
      store: typeof routes['auth.access_tokens.store']
    }
    emailVerifications: {
      store: typeof routes['auth.email_verifications.store']
    }
    passwordResets: {
      store: typeof routes['auth.password_resets.store']
      update: typeof routes['auth.password_resets.update']
    }
  }
  profile: {
    profile: {
      show: typeof routes['profile.profile.show']
    }
    accessTokens: {
      destroy: typeof routes['profile.access_tokens.destroy']
    }
    emailVerifications: {
      resend: typeof routes['profile.email_verifications.resend']
    }
  }
}
