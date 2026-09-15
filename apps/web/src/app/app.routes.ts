import { Routes } from '@angular/router';

import { authGuard } from './core/auth/auth.guard';

export const routes: Routes = [
  {
    path: '',
    loadComponent: () => import('./welcome/welcome.page').then((m) => m.WelcomePage),
  },
  {
    path: 'auth',
    loadChildren: () => import('./auth/auth.routes').then((m) => m.AUTH_ROUTES),
  },
  {
    path: 'me',
    loadChildren: () => import('./auth/auth.routes').then((m) => m.ACCOUNT_ROUTES),
  },
  {
    // Future cellar collection surface — protected early so Bearer wiring is visible.
    path: 'cellar',
    canActivate: [authGuard],
    loadChildren: () => import('./auth/auth.routes').then((m) => m.ACCOUNT_ROUTES),
  },
  { path: '**', redirectTo: '' },
];
