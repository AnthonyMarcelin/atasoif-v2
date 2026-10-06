import { Routes } from '@angular/router';

import { signedInHomeGuard } from './core/auth/signed-in-home.guard';

export const routes: Routes = [
  {
    path: '',
    loadComponent: () => import('./welcome/welcome.page').then((m) => m.WelcomePage),
    canActivate: [signedInHomeGuard],
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
    path: 'cave',
    loadChildren: () => import('./cellar/cellar.routes').then((m) => m.CELLAR_ROUTES),
  },
  {
    path: 'cellar',
    redirectTo: 'cave',
    pathMatch: 'full',
  },
  { path: '**', redirectTo: '' },
];
