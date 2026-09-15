import { Routes } from '@angular/router';

import { AuthShell } from './auth-shell';
import { AccountPage } from './account.page';
import { ForgotPasswordPage } from './forgot-password.page';
import { LoginPage } from './login.page';
import { RegisterPage } from './register.page';

export const AUTH_ROUTES: Routes = [
  {
    path: '',
    component: AuthShell,
    children: [
      { path: 'register', component: RegisterPage },
      { path: 'login', component: LoginPage },
      { path: 'forgot-password', component: ForgotPasswordPage },
      { path: '', pathMatch: 'full', redirectTo: 'register' },
    ],
  },
];

export const ACCOUNT_ROUTES: Routes = [{ path: '', component: AccountPage }];
