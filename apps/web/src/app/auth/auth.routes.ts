import { Routes } from '@angular/router';

import { authGuard } from '../core/auth/auth.guard';
import { emailVerifiedGuard } from '../core/auth/email-verified.guard';
import { AuthShell } from './auth-shell';
import { AccountPage } from './account.page';
import { ForgotPasswordPage } from './forgot-password.page';
import { LoginPage } from './login.page';
import { OauthCallbackPage } from './oauth-callback.page';
import { RegisterPage } from './register.page';
import { VerifyEmailPage } from './verify-email.page';

export const AUTH_ROUTES: Routes = [
  {
    path: '',
    component: AuthShell,
    children: [
      { path: 'register', component: RegisterPage },
      { path: 'login', component: LoginPage },
      { path: 'forgot-password', component: ForgotPasswordPage },
      { path: 'verify-email', component: VerifyEmailPage },
      { path: 'oauth/callback', component: OauthCallbackPage },
      { path: '', pathMatch: 'full', redirectTo: 'register' },
    ],
  },
];

/** Authenticated + email-verified account / cellar entry. */
export const ACCOUNT_ROUTES: Routes = [
  { path: '', component: AccountPage, canActivate: [authGuard, emailVerifiedGuard] },
];
