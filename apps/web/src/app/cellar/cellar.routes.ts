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
        path: 'catalogue',
        loadComponent: () =>
          import('./catalog-shell.page').then((m) => m.CatalogShellPage),
      },
      {
        path: 'amis',
        loadComponent: () =>
          import('./friends-shell.page').then((m) => m.FriendsShellPage),
      },
      {
        path: 'partage',
        loadComponent: () =>
          import('./share-settings.page').then((m) => m.ShareSettingsPage),
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
