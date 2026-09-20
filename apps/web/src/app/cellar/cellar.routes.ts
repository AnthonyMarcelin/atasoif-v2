import { Routes } from '@angular/router';

import { authGuard } from '../core/auth/auth.guard';
import { emailVerifiedGuard } from '../core/auth/email-verified.guard';

export const CELLAR_ROUTES: Routes = [
  {
    path: '',
    canActivate: [authGuard, emailVerifiedGuard],
    children: [
      {
        path: '',
        loadComponent: () =>
          import('./cellar-list.page').then((m) => m.CellarListPage),
      },
      {
        path: 'ajouter',
        loadComponent: () => import('./cellar-add.page').then((m) => m.CellarAddPage),
      },
      {
        path: 'premium',
        loadComponent: () =>
          import('./cellar-paywall.page').then((m) => m.CellarPaywallPage),
      },
      {
        path: ':id',
        loadComponent: () =>
          import('./cellar-detail.page').then((m) => m.CellarDetailPage),
      },
    ],
  },
];
