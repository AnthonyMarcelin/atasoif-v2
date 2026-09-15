import { Routes } from '@angular/router';

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
    path: 'moi',
    loadChildren: () => import('./auth/auth.routes').then((m) => m.ACCOUNT_ROUTES),
  },
  { path: '**', redirectTo: '' },
];
